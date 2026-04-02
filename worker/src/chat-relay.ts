import { DurableObject } from "cloudflare:workers";
import { sendPushNotification, PushSubscriptionData } from "./web-push";
import { validateDesoJwt } from "./jwt";
import { updateLastSeen } from "./db";

interface WsMessage {
  type: "notify" | "typing" | "read" | "register";
  publicKey?: string;
  jwt?: string;
  threadId?: string;
  recipients?: string[];
  from?: string;
  fromUsername?: string;
  conversationKey?: string;
  groupName?: string;
}

interface ConnectedClient {
  ws: WebSocket;
  publicKey: string;
  lastSeen: number;
}

export interface RelayEnv {
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  DESO_NODE_URL: string;
  DB: D1Database;
}

export class ChatRelay extends DurableObject<RelayEnv> {
  private clients: Map<string, ConnectedClient[]> = new Map();
  private dbReady = false;

  private ensureDb() {
    if (this.dbReady) return;
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        public_key TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (public_key, endpoint)
      )
    `);
    this.dbReady = true;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    // Push subscription management
    if (url.pathname === "/push/subscribe" && request.method === "POST") {
      return this.handlePushSubscribe(request);
    }
    if (url.pathname === "/push/unsubscribe" && request.method === "POST") {
      return this.handlePushUnsubscribe(request);
    }

    return new Response("Not found", { status: 404 });
  }

  // ── Push subscription endpoints ──

  private async handlePushSubscribe(request: Request): Promise<Response> {
    try {
      const { publicKey, subscription } = await request.json<{
        publicKey: string;
        subscription: PushSubscriptionData;
      }>();

      if (!publicKey || !subscription?.endpoint || !subscription?.keys) {
        return new Response("Missing fields", { status: 400 });
      }

      this.ensureDb();
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO push_subscriptions (public_key, endpoint, p256dh, auth)
         VALUES (?, ?, ?, ?)`,
        publicKey,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth
      );

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response("Bad request", { status: 400 });
    }
  }

  private async handlePushUnsubscribe(request: Request): Promise<Response> {
    try {
      const { publicKey, endpoint } = await request.json<{
        publicKey: string;
        endpoint: string;
      }>();

      this.ensureDb();
      this.ctx.storage.sql.exec(
        `DELETE FROM push_subscriptions WHERE public_key = ? AND endpoint = ?`,
        publicKey,
        endpoint
      );

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response("Bad request", { status: 400 });
    }
  }

  // ── WebSocket handlers ──

  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer) {
    try {
      const message: WsMessage = JSON.parse(
        typeof rawMessage === "string"
          ? rawMessage
          : new TextDecoder().decode(rawMessage)
      );

      switch (message.type) {
        case "register":
          await this.handleRegister(ws, message);
          break;
        case "notify":
          await this.handleNotify(message);
          break;
        case "typing":
          this.handleTyping(ws, message);
          break;
        case "read":
          this.handleRead(ws, message);
          break;
      }
    } catch {
      // Ignore malformed messages
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.removeClient(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.removeClient(ws);
  }

  private async handleRegister(ws: WebSocket, message: WsMessage) {
    const { publicKey, jwt } = message;
    if (!publicKey) return;

    // Verify the caller owns this public key
    if (!jwt || !(await validateDesoJwt(this.env.DESO_NODE_URL, publicKey, jwt))) {
      try { ws.send(JSON.stringify({ type: "error", message: "Invalid JWT" })); } catch { /* ignore */ }
      return;
    }

    const existing = this.clients.get(publicKey) || [];
    existing.push({ ws, publicKey, lastSeen: Date.now() });
    this.clients.set(publicKey, existing);
    this.broadcastPresence();
  }

  private async handleNotify(message: WsMessage) {
    const { recipients, threadId, from, fromUsername, groupName } = message;
    if (!recipients || !threadId) return;

    const pushPromises: Promise<void>[] = [];

    for (const recipientKey of recipients) {
      // Don't notify the sender about their own message
      if (recipientKey === from) continue;

      // Always try WebSocket delivery for real-time UI update
      const clients = this.clients.get(recipientKey) || [];
      for (const client of clients) {
        try {
          client.ws.send(JSON.stringify({ type: "new-message", threadId, from }));
        } catch {
          // Client disconnected
        }
      }

      // Always send push — the service worker suppresses if the app is visible
      if (this.env.VAPID_PRIVATE_KEY) {
        pushPromises.push(
          this.sendPushToUser(recipientKey, fromUsername || from || "Someone", threadId, from, groupName)
        );
      }
    }

    // Await all push deliveries so the DO doesn't hibernate before they complete
    await Promise.all(pushPromises);
  }

  private async sendPushToUser(publicKey: string, fromName: string, threadId: string, fromPublicKey?: string, groupName?: string) {
    this.ensureDb();
    const rows = this.ctx.storage.sql.exec(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE public_key = ?`,
      publicKey
    ).toArray();

    const expiredEndpoints: string[] = [];

    for (const row of rows) {
      const sub: PushSubscriptionData = {
        endpoint: row.endpoint as string,
        keys: { p256dh: row.p256dh as string, auth: row.auth as string },
      };

      const title = groupName ? groupName : "New message";
      const body = groupName
        ? `${fromName}: new message`
        : `${fromName} sent you a message`;

      const result = await sendPushNotification(
        sub,
        {
          title,
          body,
          tag: `thread-${threadId}`,
          conversationKey: threadId,
          from: fromPublicKey,
        },
        this.env.VAPID_PRIVATE_KEY,
        this.env.VAPID_SUBJECT || "mailto:hello@chaton.app"
      );

      if (result === "expired") {
        expiredEndpoints.push(sub.endpoint);
      }
    }

    // Clean up expired subscriptions
    for (const endpoint of expiredEndpoints) {
      this.ctx.storage.sql.exec(
        `DELETE FROM push_subscriptions WHERE public_key = ? AND endpoint = ?`,
        publicKey,
        endpoint
      );
    }
  }

  private handleTyping(ws: WebSocket, message: WsMessage) {
    const { conversationKey } = message;
    if (!conversationKey) return;

    const senderKey = this.findPublicKey(ws);
    if (!senderKey) return;

    for (const [pubKey, clients] of this.clients) {
      if (pubKey === senderKey) continue;
      for (const client of clients) {
        try {
          client.ws.send(JSON.stringify({ type: "typing", from: senderKey, conversationKey }));
        } catch { /* ignore */ }
      }
    }
  }

  private handleRead(ws: WebSocket, message: WsMessage) {
    const { conversationKey } = message;
    if (!conversationKey) return;

    const senderKey = this.findPublicKey(ws);
    if (!senderKey) return;

    for (const [pubKey, clients] of this.clients) {
      if (pubKey === senderKey) continue;
      for (const client of clients) {
        try {
          client.ws.send(JSON.stringify({ type: "read", from: senderKey, conversationKey }));
        } catch { /* ignore */ }
      }
    }
  }

  private broadcastPresence() {
    const users: Record<string, "online"> = {};
    for (const pubKey of this.clients.keys()) users[pubKey] = "online";
    const msg = JSON.stringify({ type: "presence", users });

    for (const clients of this.clients.values()) {
      for (const client of clients) {
        try { client.ws.send(msg); } catch { /* ignore */ }
      }
    }
  }

  private findPublicKey(ws: WebSocket): string | null {
    for (const [pubKey, clients] of this.clients) {
      if (clients.some((c) => c.ws === ws)) return pubKey;
    }
    return null;
  }

  private removeClient(ws: WebSocket) {
    for (const [pubKey, clients] of this.clients) {
      const filtered = clients.filter((c) => c.ws !== ws);
      if (filtered.length === 0) {
        this.clients.delete(pubKey);
        this.ctx.waitUntil(
          updateLastSeen(this.env.DB, pubKey).catch(() => {/* best-effort */})
        );
      } else {
        this.clients.set(pubKey, filtered);
      }
    }
    this.broadcastPresence();
  }
}
