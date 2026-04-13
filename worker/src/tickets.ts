import type { Env } from "./index";
import {
  json,
  sanitize,
  sanitizeRequired,
  checkRateLimit,
  verifyApiKey,
  VALID_ERROR_CODES,
} from "./shared-validation";
import { validateDesoJwt } from "./jwt";

const VALID_FREQUENCIES = new Set(["first-time", "sometimes", "every-time"]);

// ── Submit (user-facing, origin-checked) ──
export async function handleTicketSubmit(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Validate required fields
    const required = [
      "errorCode",
      "errorMessage",
      "component",
      "route",
      "appVersion",
      "userAgent",
      "platform",
      "userDescription",
      "frequency",
      "submitterPublicKey",
      "signature",
      "nonce",
    ];
    for (const field of required) {
      if (!body[field]) return json({ error: `Missing: ${field}` }, 400);
    }

    const errorCode = body.errorCode as string;
    const publicKey = body.submitterPublicKey as string;
    const jwt = body.signature as string;

    // Verify the caller owns this public key
    if (!(await validateDesoJwt(env.DESO_NODE_URL, publicKey, jwt))) {
      return json({ error: "Invalid or missing JWT" }, 401);
    }

    // Error code allowlist
    if (!VALID_ERROR_CODES.has(errorCode)) {
      return json({ error: "Invalid error code" }, 400);
    }

    // Frequency validation
    if (!VALID_FREQUENCIES.has(body.frequency as string)) {
      return json({ error: "Invalid frequency" }, 400);
    }

    // Rate limit: 5 tickets/user/hour, 50 global/hour
    if (!checkRateLimit("ticket", publicKey)) {
      return json({ error: "Rate limit exceeded" }, 429);
    }

    // Sanitize user-provided fields
    const userDescription = sanitize(body.userDescription as string, 500);
    const additionalContext = body.additionalContext
      ? sanitize(body.additionalContext as string, 300)
      : null;
    const errorMessage = sanitize(body.errorMessage as string, 500);
    const stackTrace = body.stackTrace
      ? sanitize(body.stackTrace as string, 2000)
      : null;
    const screenshotUrl = body.screenshotUrl
      ? sanitize(body.screenshotUrl as string, 2000)
      : null;
    const reporterUsername = body.reporterUsername
      ? sanitize(body.reporterUsername as string, 100)
      : null;

    if (!userDescription) return json({ error: "Description required" }, 400);

    // Sanitize required fields — reject if any are empty after sanitization
    const component = sanitizeRequired(body.component as string, 200);
    const route = sanitizeRequired(body.route as string, 200);
    const appVersion = sanitizeRequired(body.appVersion as string, 50);
    const platform = sanitizeRequired(body.platform as string, 20);
    if (!component || !route || !appVersion || !platform) {
      return json({ error: "Required field is empty after sanitization" }, 400);
    }

    // User-reported bugs (unknown error code) always get their own ticket.
    // Auto-captured errors upsert: same user + error + component = update existing.
    const isUserReported = errorCode === "unknown";

    const sql = isUserReported
      ? `
      INSERT INTO tickets (
        error_code, error_message, stack_trace, component, route,
        app_version, user_agent, platform, user_description, frequency,
        additional_context, screenshot_url, submitter_public_key, signature, nonce,
        reporter_username
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      : `
      INSERT INTO tickets (
        error_code, error_message, stack_trace, component, route,
        app_version, user_agent, platform, user_description, frequency,
        additional_context, screenshot_url, submitter_public_key, signature, nonce,
        reporter_username
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (submitter_public_key, error_code, component)
      DO UPDATE SET
        user_description = excluded.user_description,
        frequency = excluded.frequency,
        additional_context = excluded.additional_context,
        screenshot_url = excluded.screenshot_url,
        error_message = excluded.error_message,
        stack_trace = excluded.stack_trace,
        signature = excluded.signature,
        nonce = excluded.nonce,
        reporter_username = excluded.reporter_username,
        updated_at = datetime('now')
    `;

    const result = await env.DB.prepare(sql)
      .bind(
        errorCode,
        errorMessage,
        stackTrace,
        component,
        route,
        appVersion,
        sanitize(body.userAgent as string, 500),
        platform,
        userDescription,
        body.frequency as string,
        additionalContext,
        screenshotUrl,
        publicKey,
        jwt,
        body.nonce as string,
        reporterUsername
      )
      .run();

    return json({ success: true, id: result.meta.last_row_id }, 201);
  } catch (err) {
    console.error("Ticket submit error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}

// ── Poll (internal, API key auth) ──
export async function handleTicketPoll(
  request: Request,
  env: Env
): Promise<Response> {
  if (!verifyApiKey(request, env))
    return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "open";
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "10") || 10,
    50
  );

  const { results } = await env.DB.prepare(
    "SELECT * FROM tickets WHERE status = ? ORDER BY created_at ASC LIMIT ?"
  )
    .bind(status, limit)
    .all();

  return json({ tickets: results || [] });
}

// ── Update (internal, API key auth) ──

const VALID_TICKET_STATUSES = new Set([
  "open", "triaging", "fixing", "fixed", "escalated", "rejected", "duplicate",
]);
const VALID_SEVERITIES = new Set([
  "trivial", "easy", "moderate", "hard", "critical",
]);

export async function handleTicketUpdate(
  request: Request,
  env: Env
): Promise<Response> {
  if (!verifyApiKey(request, env))
    return json({ error: "Unauthorized" }, 401);

  try {
    const url = new URL(request.url);
    const id = parseInt(url.pathname.split("/").pop() || "", 10);
    if (isNaN(id)) return json({ error: "Invalid ID" }, 400);

    const body = (await request.json()) as Record<string, unknown>;

    // Validate enum fields before building query
    if (body.status !== undefined && !VALID_TICKET_STATUSES.has(body.status as string)) {
      return json({ error: "Invalid status" }, 400);
    }
    if (body.severity !== undefined && !VALID_SEVERITIES.has(body.severity as string)) {
      return json({ error: "Invalid severity" }, 400);
    }

    const allowed: Record<string, string> = {
      status: "status",
      severity: "severity",
      error_code: "error_code",
      triage_notes: "notes",
      fix_branch: "fix_branch",
      fix_pr_url: "fix_pr_url",
      github_issue_url: "issue_url",
    };

    const updates: string[] = [];
    const values: unknown[] = [];
    for (const [apiField, dbField] of Object.entries(allowed)) {
      if (body[apiField] !== undefined) {
        updates.push(`${dbField} = ?`);
        values.push(body[apiField]);
      }
    }
    if (updates.length === 0) return json({ error: "No fields" }, 400);

    updates.push("updated_at = datetime('now')");
    values.push(id);

    const result = await env.DB.prepare(
      `UPDATE tickets SET ${updates.join(", ")} WHERE id = ?`
    )
      .bind(...values)
      .run();

    if (result.meta.changes === 0) return json({ error: "Not found" }, 404);
    return json({ success: true });
  } catch (err) {
    console.error("Ticket update error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}
