import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertSnapshotForDate, isoDateUTC } from "@/lib/net-worth";

export const dynamic = "force-dynamic";
// Hobby tier caps at 60s — keep this conservative so deploys succeed on
// every plan. Pro/Enterprise can raise this if needed for very large
// user bases.
export const maxDuration = 60;

/**
 * Daily cron — runs at 00:10 UTC. For every user who owns at least one asset,
 * insert a `net_worth_snapshots` row for yesterday (the day that just ended
 * in UTC). Skips users that already have a row for that date.
 *
 * Auth: bearer token in Authorization header. Set CRON_SECRET in env.
 * Vercel cron jobs send the configured secret automatically when CRON_SECRET
 * is set as an env var; for local testing curl with the same value.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();

  // Compute "yesterday in UTC". The cron runs at 00:10 UTC, so the date that
  // just ended is yesterday-from-now's perspective (today UTC - 1 day).
  // Using `as_of` query param overrides for local testing.
  const url = new URL(request.url);
  const asOfParam = url.searchParams.get("as_of");
  const target = asOfParam ? new Date(asOfParam) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (!Number.isFinite(target.getTime())) {
    return new Response("Bad as_of parameter", { status: 400 });
  }

  // Fetch all distinct user_ids that own at least one asset. We page through
  // in batches of 1000 — at scale this becomes a job-queue problem, but for
  // v1 a single pass is fine.
  const { data: rows, error } = await admin
    .from("assets")
    .select("user_id")
    .limit(10000);
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));

  let succeeded = 0;
  const failures: { user_id: string; error: string }[] = [];

  for (const userId of userIds) {
    try {
      await upsertSnapshotForDate(userId, target);
      succeeded += 1;
    } catch (e) {
      failures.push({
        user_id: userId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return Response.json({
    ok: true,
    target_date: isoDateUTC(target),
    users_processed: userIds.length,
    succeeded,
    failures,
  });
}
