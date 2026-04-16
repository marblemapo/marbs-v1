/**
 * FX rates via Frankfurter (ECB, free, no API key).
 *   GET https://api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP,HKD,JPY
 *   → { base: "USD", date: "2026-04-17", rates: { EUR: 0.85, GBP: 0.72, ... } }
 *
 * Covers 30+ major fiat currencies (USD, EUR, GBP, HKD, JPY, SGD, KRW, CNY,
 * INR, AUD, CAD, CHF, etc.). Good enough for the ICP we're targeting.
 *
 * Not covered (as of writing): TWD, HKD-pegged cryptos, exotic EM currencies.
 * Callers should treat null as "can't convert; show native".
 */

/**
 * Fetch rates for converting FROM `base` TO each of `quotes`. Returns a map
 * with `base` always included as 1, so downstream code can do
 * `amount * rates[to] / rates[from]` for any pair.
 *
 * Cache: 6 hours. Frankfurter updates daily with ECB data.
 */
export async function fetchFxRates(
  base: string,
  quotes: string[],
): Promise<Record<string, number> | null> {
  const uniqueQuotes = Array.from(
    new Set(quotes.map((c) => c.toUpperCase()).filter((c) => c !== base)),
  );
  if (uniqueQuotes.length === 0) {
    // No conversion needed — just the identity rate.
    return { [base.toUpperCase()]: 1 };
  }

  const url = `https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(
    base,
  )}&to=${uniqueQuotes.join(",")}`;

  try {
    const res = await fetch(url, { next: { revalidate: 21600 } }); // 6h
    if (!res.ok) return null;
    const data = await res.json();
    const rates = (data?.rates ?? {}) as Record<string, number>;
    // Frankfurter omits the base from its `rates` object; add it as 1.
    return { [base.toUpperCase()]: 1, ...rates };
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
