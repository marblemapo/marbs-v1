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
  source: "yahoo" | "coingecko" | "finnhub" | "manual";
  asOf: string; // ISO timestamp
};

/**
 * Map a Finnhub/Yahoo exchange-suffix ticker to its trading currency.
 * Finnhub's /quote doesn't return currency, so we infer from the suffix.
 * Examples: "TSLA" → USD, "0700.HK" → HKD, "VOD.L" → GBP, "7203.T" → JPY.
 */
export function inferCurrencyFromTicker(ticker: string): string {
  const parts = ticker.split(".");
  if (parts.length < 2) return "USD";
  const suffix = parts[parts.length - 1].toUpperCase();
  const map: Record<string, string> = {
    HK: "HKD",
    L: "GBP", LON: "GBP",
    T: "JPY",
    TO: "CAD", V: "CAD",
    DE: "EUR", F: "EUR", MU: "EUR", DU: "EUR", TG: "EUR",
    AS: "EUR", PA: "EUR", MI: "EUR", MC: "EUR", BR: "EUR",
    SW: "CHF", VX: "CHF",
    ST: "SEK", CO: "DKK", OL: "NOK", HE: "EUR",
    AX: "AUD", NZ: "NZD",
    SI: "SGD",
    KS: "KRW", KQ: "KRW",
    SS: "CNY", SZ: "CNY",
    NS: "INR", BO: "INR",
    SA: "BRL",
    MX: "MXN",
    JK: "IDR",
    BK: "THB",
    TW: "TWD",
    JO: "ZAR",
  };
  return map[suffix] ?? "USD";
}

/**
 * Finnhub /stock/profile2 — one-time company profile fetch. Used to grab the
 * logo URL on asset creation. Also returns canonical currency and name;
 * callers can override our suffix-based inference when present.
 *
 * Returns null if Finnhub doesn't have a profile for this symbol (common for
 * non-US tickers outside the premium plan).
 */
export async function fetchFinnhubProfile(symbol: string): Promise<{
  logo: string | null;
  name: string | null;
  currency: string | null;
  exchange: string | null;
} | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(
    symbol,
  )}&token=${key}`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // 1 day cache
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || Object.keys(data).length === 0) return null;
    return {
      logo: data.logo || null,
      name: data.name || null,
      currency: data.currency || null,
      exchange: data.exchange || null,
    };
  } catch {
    return null;
  }
}

/**
 * Finnhub /quote — stock prices. Free tier: 60 req/min. Covers US + most
 * major exchanges. Returns { c: current_price } but no currency — we infer
 * from the ticker suffix above.
 */
export async function fetchFinnhubQuote(symbol: string): Promise<Quote | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    const price = typeof data?.c === "number" ? data.c : null;
    if (!price) return null;
    return {
      symbol,
      price,
      currency: inferCurrencyFromTicker(symbol),
      source: "finnhub",
      asOf: data?.t
        ? new Date(data.t * 1000).toISOString()
        : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Resolve a free-form stock query (ticker, company name, or partial) to a
 * canonical Yahoo ticker. Used as a fallback when the user types "tesla"
 * instead of "TSLA". Returns null if nothing likely-equity-or-ETF matches.
 */
export async function searchYahooSymbol(query: string): Promise<string | null> {
  if (!query.trim()) return null;
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    query,
  )}&quotesCount=8&newsCount=0&lang=en-US&region=US`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": YAHOO_UA },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;

    type YQ = { symbol?: string; quoteType?: string };
    const data = await res.json();
    const quotes: YQ[] = data?.quotes ?? [];

    // Prefer exact-symbol match, then first equity/etf.
    const upper = query.trim().toUpperCase();
    const exact = quotes.find((q) => q.symbol?.toUpperCase() === upper);
    if (exact?.symbol) return exact.symbol;
    const first = quotes.find(
      (q) =>
        q.symbol &&
        (q.quoteType === "EQUITY" || q.quoteType === "ETF" || q.quoteType === "INDEX"),
    );
    return first?.symbol ?? null;
  } catch {
    return null;
  }
}

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
      headers: { "User-Agent": YAHOO_UA }, // Yahoo blocks empty UAs from some IPs
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
  source: "yahoo" | "coingecko" | "finnhub" | "manual",
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

  if (source === "finnhub") {
    // Try Finnhub first; fall back to Yahoo if Finnhub rate-limits or misses.
    const fh = await fetchFinnhubQuote(externalId);
    if (fh) return fh;
    return fetchYahooQuote(externalId);
  }
  if (source === "yahoo") return fetchYahooQuote(externalId);
  if (source === "coingecko") return fetchCoinGeckoQuote(externalId, nativeCurrency);
  return null;
}
