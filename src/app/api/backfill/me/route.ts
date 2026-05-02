import { createClient } from "@/lib/supabase/server";
import { backfillUserHistory } from "@/lib/net-worth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manual backfill trigger for the signed-in user. Useful for forcing a
 * recompute when the dashboard's post-response after() hook didn't have
 * enough time to finish, or for diagnostics.
 *
 * Usage from the browser DevTools console while signed in:
 *   await fetch("/api/backfill/me", { method: "POST" }).then(r => r.json())
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
    await backfillUserHistory(user.id);
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

// Also accept GET so you can hit it directly from the browser address bar.
export async function GET() {
  return run();
}
