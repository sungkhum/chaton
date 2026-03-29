import { DurableObject } from "cloudflare:workers";

interface WsMessage {
  type: "notify" | "typing" | "read" | "register";
  publicKey?: string;
  threadId?: string;
  recipients?: string[];
  from?: string;
  conversationKey?: string;
}

interface ConnectedClient {
  ws: WebSocket;
  publicKey: string;
  lastSeen: number;
}

export class ChatRelay extends DurableObject {
  private clients: Map<string, ConnectedClient[]> = new Map();

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

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer) {
    try {
      const message: WsMessage = JSON.parse(
        typeof rawMessage === "string"
          ? rawMessage
          : new TextDecoder().decode(rawMessage)
      );

      switch (message.type) {
        case "register":
          this.handleRegister(ws, message);
          break;
        case "notify":
          this.handleNotify(message);
          break;
        case "typing":
          this.handleTyping(ws, message);
          break;
        case "read":
          this.handleRead(ws, message);
          break;
      }
    } catch (e) {
      // Ignore malformed messages
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.removeClient(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.removeClient(ws);
  }

  private handleRegister(ws: WebSocket, message: WsMessage) {
    const { publicKey } = message;
    if (!publicKey) return;

    const existing = this.clients.get(publicKey) || [];
    existing.push({ ws, publicKey, lastSeen: Date.now() });
    this.clients.set(publicKey, existing);

    // Broadcast presence update
    this.broadcastPresence();
  }

  private handleNotify(message: WsMessage) {
    const { recipients, threadId, from } = message;
    if (!recipients || !threadId) return;

    for (const recipientKey of recipients) {
      const clients = this.clients.get(recipientKey) || [];
      for (const client of clients) {
        try {
          client.ws.send(
            JSON.stringify({
              type: "new-message",
              threadId,
              from,
            })
          );
        } catch {
          // Client disconnected, will be cleaned up
        }
      }
    }
  }

  private handleTyping(ws: WebSocket, message: WsMessage) {
    const { conversationKey } = message;
    if (!conversationKey) return;

    const senderKey = this.findPublicKey(ws);
    if (!senderKey) return;

    // Broadcast typing to all connected clients except sender
    for (const [pubKey, clients] of this.clients) {
      if (pubKey === senderKey) continue;
      for (const client of clients) {
        try {
          client.ws.send(
            JSON.stringify({
              type: "typing",
              from: senderKey,
              conversationKey,
            })
          );
        } catch {
          // Ignore
        }
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
          client.ws.send(
            JSON.stringify({
              type: "read",
              from: senderKey,
              conversationKey,
            })
          );
        } catch {
          // Ignore
        }
      }
    }
  }

  private broadcastPresence() {
    const onlineUsers: Record<string, "online"> = {};
    for (const pubKey of this.clients.keys()) {
      onlineUsers[pubKey] = "online";
    }

    const presenceMessage = JSON.stringify({
      type: "presence",
      users: onlineUsers,
    });

    for (const clients of this.clients.values()) {
      for (const client of clients) {
        try {
          client.ws.send(presenceMessage);
        } catch {
          // Ignore
        }
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
      } else {
        this.clients.set(pubKey, filtered);
      }
    }
    this.broadcastPresence();
  }
}
