/**
 * FX rates — primary source is Frankfurter (ECB, free, no API key).
 * Frankfurter covers ~30 major currencies (USD, EUR, GBP, HKD, JPY, SGD, KRW,
 * CNY, INR, AUD, CAD, CHF, SEK, NOK, DKK, etc).
 *
 * Any quote currency Frankfurter doesn't return (e.g. TWD, PHP, SAR, AED) is
 * topped up from Yahoo Finance's FX endpoint — `{BASE}{QUOTE}=X`. Yahoo
 * covers every fiat pair we care about in Asia / MENA.
 *
 * Both are cached 6 hours.
 */

/**
 * Fetch rates for converting FROM `base` TO each of `quotes`. Returns a map
 * with `base` always included as 1, so downstream code can do
 * `amount * rates[to] / rates[from]` for any pair.
 */
export async function fetchFxRates(
  base: string,
  quotes: string[],
): Promise<Record<string, number> | null> {
  const baseUp = base.toUpperCase();
  const uniqueQuotes = Array.from(
    new Set(quotes.map((c) => c.toUpperCase()).filter((c) => c !== baseUp)),
  );
  if (uniqueQuotes.length === 0) {
    return { [baseUp]: 1 };
  }

  // Primary: Frankfurter (ECB).
  let primary: Record<string, number> = {};
  try {
    const url = `https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(
      base,
    )}&to=${uniqueQuotes.join(",")}`;
    const res = await fetch(url, {
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      primary = (data?.rates ?? {}) as Record<string, number>;
    }
  } catch {
    // Fall through — we'll see what Yahoo can cover.
  }

  const missing = uniqueQuotes.filter((q) => !primary[q]);
  const secondary: Record<string, number> = {};

  if (missing.length > 0) {
    // Fall back to Yahoo one pair at a time. The free endpoint returns a
    // chart bar with `meta.regularMarketPrice` for any `{BASE}{QUOTE}=X`.
    const results = await Promise.all(
      missing.map(async (q) => {
        const rate = await fetchYahooFxRate(baseUp, q);
        return [q, rate] as const;
      }),
    );
    for (const [q, rate] of results) {
      if (rate && Number.isFinite(rate) && rate > 0) {
        secondary[q] = rate;
      }
    }
  }

  const rates = { [baseUp]: 1, ...primary, ...secondary };

  // If we couldn't resolve ANYTHING (both sources failed outright), return
  // null so the caller falls back to showing native amounts per asset.
  if (Object.keys(rates).length <= 1 && uniqueQuotes.length > 0) return null;

  return rates;
}

const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Single-pair FX rate from Yahoo Finance. Returns null on any failure. */
async function fetchYahooFxRate(
  base: string,
  quote: string,
): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${base}${quote}=X?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { "User-Agent": YAHOO_UA },
      next: { revalidate: 21600 }, // 6h
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

/**
 * Convert `amount` from `from` to `to` using a rate map keyed to a single
 * anchor currency. Works for any pair where both sides are in the map.
 * Returns null when either currency is missing — callers should show native.
 */
export function convertFx(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number | null {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;
  const fromRate = rates[f];
  const toRate = rates[t];
  if (!fromRate || !toRate) return null;
  return amount * (toRate / fromRate);
}
