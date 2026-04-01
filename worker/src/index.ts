export { ChatRelay } from "./chat-relay";

import { handleOgFetch } from "./og";
import { handleScheduled, type PushJob } from "./poll";
import {
  upsertUser,
  upsertSubscription,
  removeSubscription,
  getSubscriptionsForUser,
  deactivateSubscription,
  incrementFailureCount,
  resetFailureCount,
} from "./db";
import { sendPushNotification, type PushSubscriptionData } from "./web-push";
import { validateDesoJwt } from "./jwt";

export interface Env {
  CHAT_RELAY: DurableObjectNamespace;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  ALLOWED_ORIGINS: string;
  DESO_NODE_URL: string;
  KLIPY_API_KEY: string;
  DB: D1Database;
  PUSH_QUEUE: Queue<PushJob>;
}

// Origins that are always allowed (localhost for dev)
const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:4173"];

function getAllowedOrigins(env: Env): string[] {
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...configured, ...DEV_ORIGINS];
}

function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return false;
  return allowed.includes(origin);
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function forbidden(): Response {
  return new Response("Forbidden", { status: 403 });
}

function withCors(response: Response, origin: string): Response {
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(corsHeaders(origin)))
    res.headers.set(k, v);
  return res;
}

export default {
  // ── HTTP fetch handler ──
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = getAllowedOrigins(env);

    // Preflight
    if (request.method === "OPTIONS") {
      if (!isOriginAllowed(origin, allowed)) return forbidden();
      return new Response(null, { headers: corsHeaders(origin!) });
    }

    // Health check — open (no secrets exposed)
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", timestamp: Date.now() }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // WebSocket upgrade — check Origin header (browsers always send it)
    if (url.pathname === "/ws") {
      if (origin && !isOriginAllowed(origin, allowed)) return forbidden();
      const id = env.CHAT_RELAY.idFromName("global-relay");
      const stub = env.CHAT_RELAY.get(id);
      return stub.fetch(request);
    }

    // Push endpoints — strict origin check, write to D1
    if (url.pathname === "/push/subscribe" && request.method === "POST") {
      if (!isOriginAllowed(origin, allowed)) return forbidden();
      const res = await handlePushSubscribe(request, env);
      return withCors(res, origin!);
    }

    // Open Graph metadata fetch
    if (url.pathname === "/og" && request.method === "POST") {
      if (!isOriginAllowed(origin, allowed)) return forbidden();
      const res = await handleOgFetch(request);
      return withCors(res, origin!);
    }

    // KLIPY API proxy — keeps the API key server-side
    if (url.pathname.startsWith("/klipy/")) {
      if (!isOriginAllowed(origin, allowed)) return forbidden();
      const res = await handleKlipyProxy(url, request, env);
      return withCors(res, origin!);
    }

    if (url.pathname === "/push/unsubscribe" && request.method === "POST") {
      if (!isOriginAllowed(origin, allowed)) return forbidden();
      const res = await handlePushUnsubscribe(request, env);
      return withCors(res, origin!);
    }

    return new Response("ChatOn Relay", { status: 200 });
  },

  // ── Cron trigger: poll DeSo for new messages ──
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await handleScheduled(env);
  },

  // ── Queue consumer: send push notifications ──
  async queue(
    batch: MessageBatch<PushJob>,
    env: Env
  ): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await deliverPush(env, msg.body);
        msg.ack();
      } catch (err) {
        console.error("Push delivery failed:", err);
        msg.retry();
      }
    }
  },
};

// ── Push subscription endpoints (D1-backed) ──

async function handlePushSubscribe(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const { publicKey, subscription, jwt } = await request.json<{
      publicKey: string;
      jwt?: string;
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    }>();

    if (!publicKey || !subscription?.endpoint || !subscription?.keys) {
      return new Response("Missing fields", { status: 400 });
    }

    // Verify the caller owns this public key
    if (!jwt || !(await validateDesoJwt(env.DESO_NODE_URL, publicKey, jwt))) {
      return new Response("Invalid or missing JWT", { status: 401 });
    }

    // Write to D1 (primary store for cron-based push)
    const userId = await upsertUser(env.DB, publicKey);
    await upsertSubscription(
      env.DB,
      userId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    // Also forward to the Durable Object so real-time relay push still works.
    // Best-effort — don't fail the response if only the DO forward errors.
    try {
      const id = env.CHAT_RELAY.idFromName("global-relay");
      const stub = env.CHAT_RELAY.get(id);
      await stub.fetch(
        new Request(new URL("/push/subscribe", request.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey, subscription }),
        })
      );
    } catch {
      console.error("DO push subscribe forward failed (best-effort)");
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response("Bad request", { status: 400 });
  }
}

async function handlePushUnsubscribe(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const { publicKey, endpoint, jwt } = await request.json<{
      publicKey: string;
      endpoint: string;
      jwt?: string;
    }>();

    // Verify the caller owns this public key
    if (!jwt || !(await validateDesoJwt(env.DESO_NODE_URL, publicKey, jwt))) {
      return new Response("Invalid or missing JWT", { status: 401 });
    }

    // Remove from D1
    await removeSubscription(env.DB, publicKey, endpoint);

    // Also forward to Durable Object (best-effort)
    try {
      const id = env.CHAT_RELAY.idFromName("global-relay");
      const stub = env.CHAT_RELAY.get(id);
      await stub.fetch(
        new Request(new URL("/push/unsubscribe", request.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey, endpoint }),
        })
      );
    } catch {
      console.error("DO push unsubscribe forward failed (best-effort)");
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response("Bad request", { status: 400 });
  }
}

// ── Queue consumer: deliver push to all user subscriptions ──

/** Deactivate after this many consecutive non-5xx failures. */
const MAX_CONSECUTIVE_FAILURES = 5;

async function deliverPush(env: Env, job: PushJob): Promise<void> {
  const subs = await getSubscriptionsForUser(env.DB, job.userId);
  if (subs.length === 0) return;

  const vapidKey = env.VAPID_PRIVATE_KEY;
  const vapidSubject = env.VAPID_SUBJECT || "mailto:hello@chaton.app";

  for (const sub of subs) {
    const subscription: PushSubscriptionData = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    const title = job.groupName ? job.groupName : "New message";
    const body = job.groupName
      ? `${job.senderName}: new message`
      : `${job.senderName} sent you a message`;

    const result = await sendPushNotification(
      subscription,
      {
        title,
        body,
        tag: `thread-${job.conversationKey}`,
        conversationKey: job.conversationKey,
      },
      vapidKey,
      vapidSubject
    );

    switch (result) {
      case "sent":
        // Reset failure counter on success
        await resetFailureCount(env.DB, sub.endpoint);
        break;

      case "expired":
        // 410/404 — subscription is definitively dead
        await deactivateSubscription(env.DB, sub.endpoint);
        break;

      case "error":
        // Non-retriable error (not 5xx) — increment failure counter
        // and deactivate if threshold exceeded
        const count = await incrementFailureCount(env.DB, sub.endpoint);
        if (count >= MAX_CONSECUTIVE_FAILURES) {
          console.warn(
            `Deactivating subscription after ${count} consecutive failures: ${sub.endpoint.slice(0, 60)}...`
          );
          await deactivateSubscription(env.DB, sub.endpoint);
        }
        break;
    }
  }
}

// ── KLIPY API proxy ──

const KLIPY_BASE = "https://api.klipy.com/api/v1";

/**
 * Proxy KLIPY API requests so the API key stays server-side.
 * Client requests: /klipy/gifs/search?q=hello
 * Proxied to:      https://api.klipy.com/api/v1/{API_KEY}/gifs/search?q=hello
 */
async function handleKlipyProxy(
  url: URL,
  request: Request,
  env: Env
): Promise<Response> {
  if (!env.KLIPY_API_KEY) {
    return new Response("KLIPY not configured", { status: 503 });
  }

  // Strip "/klipy/" prefix to get the KLIPY path (e.g. "gifs/search")
  const klipyPath = url.pathname.slice("/klipy/".length);
  if (!klipyPath) {
    return new Response("Bad request", { status: 400 });
  }

  const target = new URL(`${KLIPY_BASE}/${env.KLIPY_API_KEY}/${klipyPath}`);
  // Forward query params from original request
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  try {
    const res = await fetch(target.toString(), { method: request.method });
    return new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
    });
  } catch {
    return new Response("KLIPY request failed", { status: 502 });
  }
}
