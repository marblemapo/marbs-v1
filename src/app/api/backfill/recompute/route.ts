import { createClient } from "@/lib/supabase/server";
import { backfillUserHistory, recomputeBackfillRange } from "@/lib/net-worth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manual history repair trigger for the signed-in user.
 *
 * GET/POST /api/backfill/recompute        -> Phase 2 only
 * GET/POST /api/backfill/recompute?full=1 -> Phase 1 + Phase 2
 */
async function run(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const full =
    url.searchParams.get("full") === "1" ||
    url.searchParams.get("mode") === "full";
  const start = Date.now();

  try {
    if (full) {
      await backfillUserHistory(user.id);
    } else {
      await recomputeBackfillRange(user.id);
    }
    return Response.json({
      ok: true,
      mode: full ? "full_backfill" : "recompute",
      ms: Date.now() - start,
    });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        mode: full ? "full_backfill" : "recompute",
        ms: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
