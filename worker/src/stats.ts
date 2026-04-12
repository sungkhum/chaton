/**
 * GET /api/stats — pre-aggregated engagement, platform, and push health data.
 * Consumed by stats.getchaton.com (server-side fetch, cached 1 hour).
 */

export async function handleStats(db: D1Database): Promise<Response> {
  const [usersResult, onlineResult, activeResult, pushResult, platformResult] =
    await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) as total_users,
                  SUM(CASE WHEN push_enabled = 1 THEN 1 ELSE 0 END) as push_enabled
           FROM users`
        )
        .first(),

      db
        .prepare(`SELECT COUNT(*) as online FROM users WHERE is_online = 1`)
        .first(),

      db
        .prepare(
          `SELECT COUNT(DISTINCT conversation_key) as active_threads,
                  COUNT(DISTINCT user_public_key) as active_users
           FROM read_cursors
           WHERE updated_at > datetime('now', '-7 days')`
        )
        .first(),

      db
        .prepare(
          `SELECT COUNT(*) as total_subscriptions,
                  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                  AVG(failure_count) as avg_failures
           FROM push_subscriptions`
        )
        .first(),

      db
        .prepare(
          `SELECT platform, COUNT(*) as users FROM users GROUP BY platform`
        )
        .all(),
    ]);

  const totalUsers = (usersResult?.total_users as number) ?? 0;
  const pushEnabled = (usersResult?.push_enabled as number) ?? 0;

  const platforms: Record<string, number> = {
    ios: 0,
    android: 0,
    web: 0,
    desktop: 0,
  };
  for (const row of platformResult?.results ?? []) {
    const key = (row.platform as string)?.toLowerCase();
    if (key && key in platforms) {
      platforms[key] = row.users as number;
    }
  }

  const body = {
    engagement: {
      totalUsers,
      pushEnabled,
      pushOptInRate: totalUsers > 0 ? pushEnabled / totalUsers : 0,
      onlineNow: (onlineResult?.online as number) ?? 0,
      activeThreads: (activeResult?.active_threads as number) ?? 0,
      activeUsers7d: (activeResult?.active_users as number) ?? 0,
    },
    platforms,
    pushHealth: {
      totalSubscriptions: (pushResult?.total_subscriptions as number) ?? 0,
      active: (pushResult?.active as number) ?? 0,
      avgFailures: (pushResult?.avg_failures as number) ?? 0,
    },
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "https://stats.getchaton.com",
    },
  });
}
