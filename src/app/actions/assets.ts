"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchPrice,
  searchYahooSymbol,
  fetchFinnhubProfile,
  type Quote,
} from "@/lib/prices";
import { resolveCoinGeckoSlug } from "@/lib/crypto-slugs";

type AssetClass = "equity" | "etf" | "crypto" | "cash";
type PriceSource = "yahoo" | "coingecko" | "finnhub" | "manual";

export type AddAssetInput = {
  name: string;
  symbol: string | null;
  assetClass: AssetClass;
  nativeCurrency: string;
  externalId: string | null; // user-provided override (e.g. Advanced slug)
  priceSource: PriceSource;
  quantity: number;
  /** Optional logo URL from the search autocomplete (e.g. CoinGecko thumb). */
  logo?: string | null;
};

export type AddAssetResult =
  | { ok: true; assetId: string }
  | { ok: false; error: string };

export type MutateResult = { ok: true } | { ok: false; error: string };

/**
 * Append a new balance_snapshots row with the user's updated quantity. We
 * don't mutate historical snapshots — dashboard always reads the latest.
 * That way the history is preserved for future trend charts.
 *
 * RLS: inserts pass through the user's session; the policy requires the
 * asset_id to belong to an asset owned by auth.uid().
 */
export async function updateAssetQuantity(
  assetId: string,
  quantity: number,
): Promise<MutateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (!(quantity > 0))
    return { ok: false, error: "Quantity must be greater than zero" };

  const { error } = await supabase.from("balance_snapshots").insert({
    asset_id: assetId,
    quantity,
    source: "manual",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Delete an asset and all its history. Cascades to balance_snapshots and
 * transactions via FK ON DELETE CASCADE.
 *
 * RLS: DELETE policy on assets checks user_id = auth.uid().
 */
export async function deleteAsset(assetId: string): Promise<MutateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Create an asset + seed its first balance snapshot + cache a current price.
 *
 * We AWAIT the price fetch rather than fire-and-forget — server actions in
 * Next.js aren't guaranteed to live past their return, so unawaited fetches
 * silently drop. Downside: user waits ~0.5–2s. Upside: they see a live price
 * immediately, or a clear error telling them what's wrong with the symbol.
 *
 * Validation flow for stocks/crypto:
 *   1. Resolve external_id (crypto: slug lookup; stocks: uppercase ticker)
 *   2. Fetch quote → if null, REJECT with a symbol-specific hint
 *   3. On success: insert asset, snapshot, price_cache (service role)
 *
 * Cash shortcircuits all of this — no symbol, no lookup, no price needed.
 */
export async function addAsset(
  input: AddAssetInput,
): Promise<AddAssetResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // --- Validate input ---
  if (!input.name.trim()) return { ok: false, error: "Name is required" };
  if (!(input.quantity > 0))
    return { ok: false, error: "Quantity must be greater than zero" };
  if (!/^[A-Z]{3}$/i.test(input.nativeCurrency))
    return { ok: false, error: "Currency must be a 3-letter ISO code" };

  const nativeCurrency = input.nativeCurrency.toUpperCase();
  const normalizedSymbol = input.symbol?.trim().toUpperCase() || null;

  // --- Resolve external_id (what the price provider expects) ---
  let externalId: string | null = input.externalId?.trim() || null;

  if (!externalId && input.priceSource !== "manual") {
    if (input.assetClass === "crypto" && normalizedSymbol) {
      externalId = await resolveCoinGeckoSlug(normalizedSymbol);
      if (!externalId) {
        return {
          ok: false,
          error: `CoinGecko doesn't recognize "${input.symbol}". Try the full slug in Advanced (e.g. "bitcoin" for BTC, "polkadot" for DOT).`,
        };
      }
    } else if (input.assetClass === "equity" || input.assetClass === "etf") {
      externalId = normalizedSymbol;
    }
  }

  // --- Fetch price (await — blocks the user, but guarantees the price lands) ---
  let quote: Quote | null = null;
  if (externalId && input.priceSource !== "manual") {
    quote = await fetchPrice(input.priceSource, externalId, nativeCurrency);

    // Fallback: if direct lookup fails and we have a raw symbol (user typed
    // "tesla" without picking from autocomplete), search by name and retry.
    if (!quote && input.symbol) {
      const resolved = await searchYahooSymbol(input.symbol);
      if (resolved && resolved !== externalId) {
        externalId = resolved;
        quote = await fetchPrice(input.priceSource, externalId, nativeCurrency);
      }
    }

    if (!quote) {
      const hint =
        input.priceSource === "coingecko"
          ? `CoinGecko doesn't have a price for "${input.symbol}". Try the full slug in Advanced (e.g. "bitcoin").`
          : `Couldn't find "${input.symbol}" on the markets. Non-US stocks need a suffix (e.g. 0700.HK, VOD.L, 7203.T). Try the search as you type for correct matches.`;
      return { ok: false, error: hint };
    }
  }

  // --- Resolve a logo URL. Prefer Finnhub's company profile (HD official
  // logos). Fall back to any logo the client passed through (e.g. CoinGecko
  // thumb from autocomplete).
  let logoUrl: string | null = input.logo ?? null;
  let profileExchange: string | null = null;
  if (input.priceSource === "finnhub" && externalId) {
    const profile = await fetchFinnhubProfile(externalId);
    if (profile?.logo) logoUrl = profile.logo;
    profileExchange = profile?.exchange ?? null;
  }

  // CoinGecko returns 24px thumbs from its /search endpoint. That's fine for
  // the autocomplete dropdown (20px rendering) but blurry on the 36px asset
  // row. Upgrade the URL to /small/ (50px) with a simple path swap.
  if (input.priceSource === "coingecko" && logoUrl?.includes("/thumb/")) {
    logoUrl = logoUrl.replace("/thumb/", "/small/");
  }

  // --- Insert asset ---
  const { data: asset, error: assetErr } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      symbol: normalizedSymbol,
      asset_class: input.assetClass,
      native_currency: quote?.currency ?? nativeCurrency,
      price_source: input.priceSource,
      external_id: externalId,
      metadata:
        logoUrl || profileExchange
          ? { logo: logoUrl, exchange: profileExchange }
          : {},
    })
    .select("id")
    .single();

  if (assetErr || !asset)
    return { ok: false, error: assetErr?.message ?? "Failed to create asset" };

  // --- Seed the first balance snapshot ---
  const { error: snapErr } = await supabase.from("balance_snapshots").insert({
    asset_id: asset.id,
    quantity: input.quantity,
    source: "manual",
  });

  if (snapErr) {
    return {
      ok: false,
      error: `Asset created but snapshot failed: ${snapErr.message}`,
    };
  }

  // --- Cache the price (service role — price_cache is public-read only) ---
  if (quote && externalId) {
    const admin = createAdminClient();
    const { error: cacheErr } = await admin.from("price_cache").upsert(
      {
        external_id: externalId,
        source: input.priceSource,
        price_native: quote.price,
        currency: quote.currency,
        fetched_at: quote.asOf,
      },
      { onConflict: "external_id,source" },
    );
    // Non-fatal — we have the asset + snapshot. UI will fetch price next render.
    if (cacheErr) console.error("price_cache upsert:", cacheErr.message);
  }

  revalidatePath("/dashboard");
  return { ok: true, assetId: asset.id };
}
