import type { Env } from "./index";

// ── Error code allowlist ──
export const VALID_ERROR_CODES = new Set([
  "send-msg-failed",
  "decrypt-msg-failed",
  "media-upload-failed",
  "reaction-failed",
  "auth-derived-key",
  "auth-popup-blocked",
  "auth-snapshot-failed",
  "group-create-failed",
  "group-join-failed",
  "group-member-add-failed",
  "tip-failed",
  "association-failed",
  "insufficient-balance",
  "ws-connection-failed",
  "push-subscribe-failed",
  "api-timeout",
  "chunk-load-failed",
  "render-error",
  "unknown",
]);

// ── Rate limiting (per worker instance, resets on eviction) ──
const limits = new Map<string, { count: number; resetAt: number }>();
const globalLimits = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { perUser: number; global: number }> = {
  ticket: { perUser: 5, global: 50 },
  feedback: { perUser: 3, global: 30 },
};

let lastPrune = 0;
const PRUNE_INTERVAL = 5 * 60 * 1000; // 5 minutes

function pruneExpired(now: number) {
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  for (const [k, v] of limits) {
    if (now > v.resetAt) limits.delete(k);
  }
  for (const [k, v] of globalLimits) {
    if (now > v.resetAt) globalLimits.delete(k);
  }
}

export function checkRateLimit(type: string, publicKey: string): boolean {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const cfg = LIMITS[type] || { perUser: 5, global: 50 };

  // Periodically prune expired entries to prevent unbounded growth
  pruneExpired(now);

  // Global limit
  const gKey = `global:${type}`;
  let g = globalLimits.get(gKey);
  if (!g || now > g.resetAt) {
    g = { count: 0, resetAt: now + hourMs };
    globalLimits.set(gKey, g);
  }
  if (g.count >= cfg.global) return false;

  // Per-user limit
  const uKey = `${type}:${publicKey}`;
  let u = limits.get(uKey);
  if (!u || now > u.resetAt) {
    u = { count: 0, resetAt: now + hourMs };
    limits.set(uKey, u);
  }
  if (u.count >= cfg.perUser) return false;

  u.count++;
  g.count++;
  return true;
}

// ── Sanitization ──
const HTML_TAG_RE = /<[^>]*>/g;
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

export function sanitize(input: string, maxLen: number): string {
  return input
    .replace(HTML_TAG_RE, "")
    .replace(CONTROL_CHAR_RE, "")
    .slice(0, maxLen)
    .trim();
}

/** Sanitize and return null if the result is empty (for required fields). */
export function sanitizeRequired(
  input: string,
  maxLen: number
): string | null {
  const result = sanitize(input, maxLen);
  return result || null;
}

// ── Auth ──
export function verifyApiKey(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice(7) === env.AGENT_API_KEY;
}

// ── Response helper ──
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
