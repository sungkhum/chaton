export { ChatRelay } from "./chat-relay";

export interface Env {
  CHAT_RELAY: DurableObjectNamespace;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  ALLOWED_ORIGINS: string; // comma-separated, e.g. "https://chaton.app,https://chaton.pages.dev"
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
  for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
  return res;
}

export default {
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

    // Push endpoints — strict origin check
    if (
      url.pathname === "/push/subscribe" ||
      url.pathname === "/push/unsubscribe"
    ) {
      if (!isOriginAllowed(origin, allowed)) return forbidden();
      const id = env.CHAT_RELAY.idFromName("global-relay");
      const stub = env.CHAT_RELAY.get(id);
      const res = await stub.fetch(request);
      return withCors(res, origin!);
    }

    return new Response("ChatOn Relay", { status: 200 });
  },
};
