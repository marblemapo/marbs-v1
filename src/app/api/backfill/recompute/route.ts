import { createClient } from "@/lib/supabase/server";
import { recomputeBackfillRange } from "@/lib/net-worth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Phase-2-only recompute for the signed-in user.
 *
 * Unlike /api/backfill/me (which runs Phase 1 — external price/FX fetches —
 * then Phase 2), this endpoint skips Phase 1 entirely and immediately
 * recomputes net_worth_snapshots from whatever is already cached in
 * price_history + fx_rate_history.  Useful when:
 *
 *   - The DB has 1000+ rows with total_usd = 0 / coverage_pct = 0 from a
 *     bad earlier run (FX or price fetch failed).
 *   - The external APIs are slow / rate-limited and you just want to see
 *     the chart with today's spot-rate FX as a proxy for missing history.
 *
 * Usage (browser DevTools console while signed in):
 *   await fetch("/api/backfill/recompute", { method: "POST" }).then(r => r.json())
 *
 * Or just navigate to the URL — GET is also accepted.
 */
async function run(): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const start = Date.now();
  try {
    await recomputeBackfillRange(user.id);
    return Response.json({ ok: true, ms: Date.now() - start });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        ms: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  return run();
}

export async function GET() {
  return run();
}
