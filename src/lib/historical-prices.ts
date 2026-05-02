/**
 * Historical price fetchers — server-only.
 *
 * Strategy: Yahoo is primary for everything (stocks, ETFs, and major crypto
 * via `{SYMBOL}-USD` tickers like `BTC-USD`). It cleanly returns 5y of daily
 * data with no key. CoinGecko is the fallback for smaller cryptos Yahoo
 * doesn't carry — limited to 365 days on the free tier, which is acceptable
 * because the per-asset coverage_pct will downgrade those periods anyway.
 *
 * All fetchers are append-only writers to `price_history`. Inserts use
 * `on conflict do nothing`, so re-running backfill is cheap (the second run
 * is mostly a no-op on already-cached dates).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type HistoricalPricePoint = {
  /** ISO yyyy-mm-dd in UTC. */
  date: string;
  price_native: number;
  native_currency: string;
};

type PriceSource = "yahoo" | "coingecko" | "finnhub" | "manual";

type AssetForBackfill = {
  external_id: string;
  source: PriceSource;
  native_currency: string;
  symbol: string | null;
  asset_class: "equity" | "etf" | "crypto" | "cash";
};

/**
 * Fetch ~5 years of daily prices from Yahoo for any ticker. Returns null on
 * any failure. The ticker passed in must match Yahoo's format:
 *   - Equity/ETF: ticker as-is (e.g. "AAPL", "0700.HK", "VOD.L")
 *   - Crypto:     "{SYMBOL}-USD" (e.g. "BTC-USD", "ETH-USD")
 */
export async function fetchYahooHistory(
  ticker: string,
): Promise<HistoricalPricePoint[] | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker,
    )}?range=5y&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": YAHOO_UA },
      next: { revalidate: 86400 }, // 24h
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const currency: string = result.meta?.currency ?? "USD";

    const points: HistoricalPricePoint[] = [];
    let lastClose: number | null = null;

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      // Forward-fill: weekends/holidays return null. Carry the prior close
      // forward so the chart shows continuous data instead of gaps.
      const price: number | null =
        close != null && Number.isFinite(close) ? close : lastClose;
      if (price == null) continue;
      lastClose = price;

      const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      points.push({
        date,
        price_native: price,
        native_currency: currency.toUpperCase(),
      });
    }

    return points.length ? points : null;
  } catch {
    return null;
  }
}

/**
 * Fetch up to 365 days from CoinGecko free tier. Used as a fallback when
 * Yahoo doesn't carry a coin. Returns prices in the requested currency.
 */
export async function fetchCoinGeckoHistory(
  slug: string,
  vsCurrency: string,
): Promise<HistoricalPricePoint[] | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
      slug,
    )}/market_chart?vs_currency=${encodeURIComponent(
      vsCurrency.toLowerCase(),
    )}&days=365&interval=daily`;
    const res = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const prices: [number, number][] = data?.prices ?? [];

    const points: HistoricalPricePoint[] = [];
    const seen = new Set<string>();
    for (const [ts, price] of prices) {
      if (!Number.isFinite(price)) continue;
      const date = new Date(ts).toISOString().slice(0, 10);
      // CoinGecko returns one point per day at 00:00 UTC, but de-dupe just
      // in case (boundary days can appear twice when the request crosses midnight).
      if (seen.has(date)) continue;
      seen.add(date);
      points.push({
        date,
        price_native: price,
        native_currency: vsCurrency.toUpperCase(),
      });
    }
    return points.length ? points : null;
  } catch {
    return null;
  }
}

/**
 * Backfill price_history for one asset. Best-effort; returns a summary so
 * the orchestrator can compute coverage. Skips cash (price is implicitly 1)
 * and manual (no external source). On total fetch failure, returns
 * { inserted: 0, oldestDate: null } and the asset gets handled by the
 * coverage logic downstream.
 */
export async function backfillPriceHistoryForAsset(
  admin: SupabaseClient,
  asset: AssetForBackfill,
): Promise<{ inserted: number; oldestDate: string | null }> {
  if (asset.asset_class === "cash" || asset.source === "manual") {
    return { inserted: 0, oldestDate: null };
  }

  // Skip if we already have a recent fetch (within the last 24h). Backfill
  // is idempotent and called from many paths — this gate keeps it cheap to
  // re-trigger on every asset mutation without hammering the external APIs.
  const { data: latest } = await admin
    .from("price_history")
    .select("observation_date")
    .eq("external_id", asset.external_id)
    .eq("source", asset.source)
    .order("observation_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.observation_date) {
    const last = new Date(latest.observation_date);
    const ageMs = Date.now() - last.getTime();
    if (ageMs < 36 * 60 * 60 * 1000) {
      return { inserted: 0, oldestDate: null };
    }
  }

  let points: HistoricalPricePoint[] | null = null;

  // Yahoo first — best coverage, longest range, no rate limit issues.
  if (asset.asset_class === "crypto") {
    // For crypto, Yahoo uses `${symbol}-USD`. The symbol column on
    // assets is the ticker (e.g. "BTC", "ETH"); external_id is the
    // CoinGecko slug ("bitcoin"). We need the symbol here.
    const ticker = asset.symbol ? `${asset.symbol.toUpperCase()}-USD` : null;
    if (ticker) points = await fetchYahooHistory(ticker);
  } else {
    points = await fetchYahooHistory(asset.external_id);
  }

  // CoinGecko fallback for crypto only — equities not in Yahoo are rare
  // and CoinGecko doesn't cover them.
  if ((!points || points.length === 0) && asset.asset_class === "crypto") {
    points = await fetchCoinGeckoHistory(asset.external_id, asset.native_currency);
  }

  if (!points || points.length === 0) {
    return { inserted: 0, oldestDate: null };
  }

  // Bulk upsert. `on conflict do nothing` means re-running is cheap.
  const rows = points.map((p) => ({
    external_id: asset.external_id,
    source: asset.source,
    observation_date: p.date,
    price_native: p.price_native,
    native_currency: p.native_currency,
  }));

  // Chunk to keep the request payload reasonable (~1825 rows × small fields
  // is fine in one shot, but 500 is a safer ceiling if Supabase tightens limits).
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error, count } = await admin
      .from("price_history")
      .upsert(slice, {
        onConflict: "external_id,source,observation_date",
        ignoreDuplicates: true,
        count: "exact",
      });
    if (error) {
      console.warn(
        `[historical-prices] insert failed for ${asset.external_id}/${asset.source}:`,
        error.message,
      );
      break;
    }
    inserted += count ?? slice.length;
  }

  return {
    inserted,
    oldestDate: points[0].date,
  };
}
