export { ChatRelay } from "./chat-relay";

export interface Env {
  CHAT_RELAY: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for the frontend
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/ws") {
      // Route all WebSocket connections to a single Durable Object
      // For scale, you could shard by conversation/room
      const id = env.CHAT_RELAY.idFromName("global-relay");
      const stub = env.CHAT_RELAY.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", timestamp: Date.now() }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Chattra Relay", {
      headers: corsHeaders,
    });
  },
};
