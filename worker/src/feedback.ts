import type { Env } from "./index";
import { json, sanitize, checkRateLimit, verifyApiKey } from "./shared-validation";
import { validateDesoJwt } from "./jwt";

const VALID_CATEGORIES = new Set([
  "feature-request",
  "improvement",
  "question",
  "praise",
  "other",
]);

// ── Submit (user-facing, origin-checked) ──
export async function handleFeedbackSubmit(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const required = [
      "category",
      "description",
      "submitterPublicKey",
      "signature",
      "nonce",
    ];
    for (const field of required) {
      if (!body[field]) return json({ error: `Missing: ${field}` }, 400);
    }

    const category = body.category as string;
    const publicKey = body.submitterPublicKey as string;
    const jwt = body.signature as string;

    // Verify the caller owns this public key
    if (!(await validateDesoJwt(env.DESO_NODE_URL, publicKey, jwt))) {
      return json({ error: "Invalid or missing JWT" }, 401);
    }

    if (!VALID_CATEGORIES.has(category)) {
      return json({ error: "Invalid category" }, 400);
    }

    // Rate limit: 3 feedback/user/hour
    if (!checkRateLimit("feedback", publicKey)) {
      return json({ error: "Rate limit exceeded" }, 429);
    }

    const description = sanitize(body.description as string, 1000);
    if (!description) return json({ error: "Description required" }, 400);

    // Auto-capture light context
    const appVersion = sanitize((body.appVersion as string) || "unknown", 50);
    const userAgent = sanitize((body.userAgent as string) || "", 500);
    const platform = sanitize((body.platform as string) || "web", 20);
    const route = sanitize((body.route as string) || "/", 200);

    const result = await env.DB.prepare(
      `
      INSERT INTO feedback (
        category, description, submitter_public_key, signature, nonce,
        app_version, user_agent, platform, route
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (submitter_public_key, category)
      DO UPDATE SET
        description = excluded.description,
        signature = excluded.signature,
        nonce = excluded.nonce,
        updated_at = datetime('now')
    `
    )
      .bind(
        category,
        description,
        publicKey,
        body.signature as string,
        body.nonce as string,
        appVersion,
        userAgent,
        platform,
        route
      )
      .run();

    return json({ success: true, id: result.meta.last_row_id }, 201);
  } catch (err) {
    console.error("Feedback submit error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}

// ── Poll (internal, API key auth) ──
export async function handleFeedbackPoll(
  request: Request,
  env: Env
): Promise<Response> {
  if (!verifyApiKey(request, env))
    return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "new";
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "10") || 10,
    50
  );

  const { results } = await env.DB.prepare(
    "SELECT * FROM feedback WHERE status = ? ORDER BY created_at ASC LIMIT ?"
  )
    .bind(status, limit)
    .all();

  return json({ feedback: results || [] });
}

// ── Update (internal, API key auth) ──

const VALID_FEEDBACK_STATUSES = new Set(["new", "reviewed", "planned", "wont-do", "done"]);
const VALID_PRIORITIES = new Set(["low", "medium", "high"]);

export async function handleFeedbackUpdate(
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

    if (body.status !== undefined && !VALID_FEEDBACK_STATUSES.has(body.status as string)) {
      return json({ error: "Invalid status" }, 400);
    }
    if (body.priority !== undefined && !VALID_PRIORITIES.has(body.priority as string)) {
      return json({ error: "Invalid priority" }, 400);
    }

    const allowed: Record<string, string> = {
      status: "status",
      priority: "priority",
      notes: "notes",
      issue_url: "issue_url",
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
      `UPDATE feedback SET ${updates.join(", ")} WHERE id = ?`
    )
      .bind(...values)
      .run();

    if (result.meta.changes === 0) return json({ error: "Not found" }, 404);
    return json({ success: true });
  } catch (err) {
    console.error("Feedback update error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}
