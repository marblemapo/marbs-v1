/**
 * Price fetchers — server-only (no API keys needed for Yahoo or CoinGecko).
 * See REBUILD_PLAN.md for the provider architecture decision.
 *
 * Each fetcher returns a normalized Quote, or null on miss. Callers should
 * fall back between providers (e.g. Yahoo primary → Twelve Data break-glass).
 */

export type Quote = {
  symbol: string;
  price: number;
  currency: string;
  source: "yahoo" | "coingecko" | "manual";
  asOf: string; // ISO timestamp
};

/**
 * Yahoo Finance — listed securities + FX (via `EURUSD=X` convention).
 * Works for US, HK, UK, AU, JP, KR, DE, SG, IN, FR. No auth.
 * Caveat: unofficial API, can change without notice.
 */
export async function fetchYahooQuote(symbol: string): Promise<Quote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=1d`;

  try {
    const res = await fetch(url, {
      headers: {
        // Yahoo blocks requests without a user-agent from some IPs.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 60 }, // Next.js server cache, 60s
    });
    if (!res.ok) return null;

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;

    let price = meta.regularMarketPrice;
    let currency: string = meta.currency;

    // Yahoo returns UK pence (GBp) for LSE listings — normalize to GBP.
    if (currency === "GBp") {
      price = price / 100;
      currency = "GBP";
    }

    return {
      symbol,
      price,
      currency,
      source: "yahoo",
      asOf: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * CoinGecko — crypto prices, native multi-currency. No auth on free tier.
 * `coinId` is the CoinGecko slug (e.g. "bitcoin", "ethereum"), NOT the ticker.
 * See: https://api.coingecko.com/api/v3/coins/list
 */
export async function fetchCoinGeckoQuote(
  coinId: string,
  vsCurrency: string = "usd",
): Promise<Quote | null> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    coinId,
  )}&vs_currencies=${encodeURIComponent(vsCurrency.toLowerCase())}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;

    const data = await res.json();
    const price = data?.[coinId]?.[vsCurrency.toLowerCase()];
    if (typeof price !== "number") return null;

    return {
      symbol: coinId,
      price,
      currency: vsCurrency.toUpperCase(),
      source: "coingecko",
      asOf: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Unified entry point — dispatches to the right provider based on source hint.
 * Callers pass the asset's `price_source` and `external_id` from the DB.
 *
 * For cash assets (source='manual', externalId=null), returns a synthetic
 * quote of price=1 so downstream value calculations (qty × price) still work.
 */
export async function fetchPrice(
  source: "yahoo" | "coingecko" | "manual",
  externalId: string | null,
  nativeCurrency: string,
): Promise<Quote | null> {
  if (source === "manual" || !externalId) {
    return {
      symbol: externalId ?? "CASH",
      price: 1,
      currency: nativeCurrency.toUpperCase(),
      source: "manual",
      asOf: new Date().toISOString(),
    };
  }

  if (source === "yahoo") return fetchYahooQuote(externalId);
  if (source === "coingecko") return fetchCoinGeckoQuote(externalId, nativeCurrency);
  return null;
}
