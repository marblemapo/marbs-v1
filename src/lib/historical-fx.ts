/**
 * Historical FX rate fetchers — server-only.
 *
 * Primary: Frankfurter (ECB-backed, free, no key, ~30 major currencies).
 * Fallback: Yahoo `{BASE}{QUOTE}=X` for currencies Frankfurter doesn't
 *   cover (e.g. TWD, AED). Same fallback pattern as `lib/fx.ts` uses for
 *   spot rates — extended here to historical daily series.
 *
 * Storage convention: we always store rates with `base = USD`. Any
 * currency-to-currency conversion uses `rate(quote) / rate(other_quote)`,
 * matching how `lib/fx.ts:convertFx` works.
 *
 * Forward-fill: ECB only publishes business days; Yahoo skips weekends.
 * The compute step in net-worth.ts forward-fills any gap when reading.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FRANKFURTER_CURRENCIES = new Set([
  "AUD", "BGN", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP",
  "HKD", "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW", "MXN", "MYR",
  "NOK", "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY", "USD", "ZAR",
]);

export type HistoricalFxPoint = {
  date: string; // ISO yyyy-mm-dd UTC
  rate: number;
};

/**
 * Fetch 5y of daily USD→quote rates from Frankfurter. Returns null if the
 * currency isn't supported or the request fails.
 */
export async function fetchFrankfurterHistory(
  quote: string,
): Promise<HistoricalFxPoint[] | null> {
  const upper = quote.toUpperCase();
  if (!FRANKFURTER_CURRENCIES.has(upper)) return null;
  if (upper === "USD") {
    // No-op pair: 1 USD = 1 USD. Skip the network call.
    return null;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const fiveYearsAgo = new Date(Date.now() - 1825 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const url = `https://api.frankfurter.dev/v1/${fiveYearsAgo}..${today}?from=USD&to=${upper}`;
    const res = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rates: Record<string, Record<string, number>> = data?.rates ?? {};

    const points: HistoricalFxPoint[] = [];
    for (const [date, ratesMap] of Object.entries(rates)) {
      const r = ratesMap[upper];
      if (typeof r === "number" && r > 0) {
        points.push({ date, rate: r });
      }
    }
    points.sort((a, b) => a.date.localeCompare(b.date));
    return points.length ? points : null;
  } catch {
    return null;
  }
}

/**
 * Yahoo fallback for currencies Frankfurter doesn't cover. Uses `USD{QUOTE}=X`.
 * Same forward-fill pattern as the price fetcher.
 */
export async function fetchYahooFxHistory(
  quote: string,
): Promise<HistoricalFxPoint[] | null> {
  const upper = quote.toUpperCase();
  if (upper === "USD") return null;

  try {
    const ticker = `USD${upper}=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker,
    )}?range=5y&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": YAHOO_UA },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    const points: HistoricalFxPoint[] = [];
    let lastRate: number | null = null;
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      const rate: number | null =
        close != null && Number.isFinite(close) ? close : lastRate;
      if (rate == null || !(rate > 0)) continue;
      lastRate = rate;
      const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      points.push({ date, rate });
    }
    return points.length ? points : null;
  } catch {
    return null;
  }
}

/**
 * Backfill fx_rate_history for one quote currency (anchored to USD). Best
 * effort, idempotent. Returns the number of rows inserted.
 */
export async function backfillFxHistoryForCurrency(
  admin: SupabaseClient,
  quote: string,
): Promise<{ inserted: number; oldestDate: string | null }> {
  const upper = quote.toUpperCase();
  if (upper === "USD") return { inserted: 0, oldestDate: null };

  // Skip if we already have a recent fetch (within last 24h).
  const { data: latest } = await admin
    .from("fx_rate_history")
    .select("observation_date")
    .eq("base", "USD")
    .eq("quote", upper)
    .order("observation_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.observation_date) {
    const last = new Date(latest.observation_date);
    if (Date.now() - last.getTime() < 36 * 60 * 60 * 1000) {
      return { inserted: 0, oldestDate: null };
    }
  }

  let points = await fetchFrankfurterHistory(upper);
  if (!points || points.length === 0) {
    points = await fetchYahooFxHistory(upper);
  }
  if (!points || points.length === 0) {
    return { inserted: 0, oldestDate: null };
  }

  const rows = points.map((p) => ({
    base: "USD",
    quote: upper,
    observation_date: p.date,
    rate: p.rate,
  }));

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error, count } = await admin
      .from("fx_rate_history")
      .upsert(slice, {
        onConflict: "base,quote,observation_date",
        ignoreDuplicates: true,
        count: "exact",
      });
    if (error) {
      console.warn(
        `[historical-fx] insert failed for USD→${upper}:`,
        error.message,
      );
      break;
    }
    inserted += count ?? slice.length;
  }

  return { inserted, oldestDate: points[0].date };
}
