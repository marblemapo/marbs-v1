import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchFinnhubProfile } from "@/lib/prices";
import { etfLogoUrl } from "@/lib/etf-logos";

/**
 * Background logo backfill for one user's equity/ETF assets.
 *
 * Server-only (not a server action), so it can safely take a userId: it runs
 * from the dashboard's after() callback, where request cookies aren't readable,
 * and uses the admin client with an explicit user_id filter in place of RLS.
 * The user-facing refreshMissingLogos() action is unchanged.
 */
export async function backfillMissingLogos(
  userId: string,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("assets")
    .select("id, symbol, external_id, asset_class, metadata")
    .eq("user_id", userId)
    .in("asset_class", ["equity", "etf"]);
  if (error) return { ok: false, error: error.message };

  const targets = (rows ?? []).filter((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    return !meta.logo || typeof meta.logo !== "string";
  });

  let updated = 0;
  await Promise.all(
    targets.map(async (r) => {
      const ticker = r.external_id ?? r.symbol;
      if (!ticker) return;

      let logo: string | null = null;
      const profile = await fetchFinnhubProfile(ticker);
      if (profile?.logo) logo = profile.logo;
      if (!logo) logo = etfLogoUrl(ticker);
      if (!logo) return;

      const nextMeta = { ...(r.metadata as Record<string, unknown>), logo };
      const { error: upErr } = await admin
        .from("assets")
        .update({ metadata: nextMeta })
        .eq("id", r.id)
        .eq("user_id", userId);
      if (!upErr) updated += 1;
    }),
  );

  return { ok: true, updated };
}
