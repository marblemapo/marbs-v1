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
  /** Price ~24h ago in the same currency. Used to compute daily delta.
      null when the provider doesn't give us history cheaply (e.g. manual). */
  previousClose: number | null;
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
 * Logo fallback: Finnhub's free tier often has no logo for recently-IPO'd
 * tickers (e.g. CRCL). When the `logo` field is empty but `weburl` is set,
 * we synthesize a Clearbit logo URL from the domain — auth-less, cached by
 * Clearbit's CDN, covers essentially every public company.
 *
 * Returns null if Finnhub doesn't have a profile for this symbol at all
 * (common for non-US tickers outside the premium plan).
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

    let logo: string | null = data.logo || null;
    if (!logo && typeof data.weburl === "string" && data.weburl) {
      const domain = extractDomain(data.weburl);
      if (domain) logo = `https://logo.clearbit.com/${domain}`;
    }

    return {
      logo,
      name: data.name || null,
      currency: data.currency || null,
      exchange: data.exchange || null,
    };
  } catch {
    return null;
  }
}

/**
 * "https://www.circle.com/en-us/" → "circle.com". Returns null if we can't
 * parse it — caller falls back to initials in that case.
 */
function extractDomain(weburl: string): string | null {
  try {
    const u = new URL(weburl);
    return u.hostname.replace(/^www\./, "");
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
    // Finnhub /quote includes `pc` (previous close) in the same response —
    // free 24h-ago price with zero extra network calls.
    const previousClose =
      typeof data?.pc === "number" && data.pc > 0 ? data.pc : null;
    return {
      symbol,
      price,
      previousClose,
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
  // Range=5d gets us a few trading days of closes so we can pick the
  // previous session's close for the TODAY delta. Weekends + holidays make
  // "exactly 24h ago" ambiguous — previous-close is the industry convention.
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=5d`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": YAHOO_UA }, // Yahoo blocks empty UAs from some IPs
      next: { revalidate: 60 }, // Next.js server cache, 60s
    });
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;

    let price = meta.regularMarketPrice;
    let currency: string = meta.currency;

    // Prefer the canonical `chartPreviousClose` / `previousClose` from meta.
    // Fall back to the penultimate daily close bar if meta lacks it.
    let previousClose: number | null =
      typeof meta.chartPreviousClose === "number"
        ? meta.chartPreviousClose
        : typeof meta.previousClose === "number"
          ? meta.previousClose
          : null;

    if (previousClose == null) {
      const closes: (number | null)[] | undefined =
        result?.indicators?.quote?.[0]?.close;
      if (Array.isArray(closes) && closes.length >= 2) {
        // Walk back from the penultimate close to skip nulls (holidays/gaps).
        for (let i = closes.length - 2; i >= 0; i--) {
          const c = closes[i];
          if (typeof c === "number" && c > 0) {
            previousClose = c;
            break;
          }
        }
      }
    }

    // Yahoo returns UK pence (GBp) for LSE listings — normalize to GBP.
    if (currency === "GBp") {
      price = price / 100;
      if (previousClose != null) previousClose = previousClose / 100;
      currency = "GBP";
    }

    return {
      symbol,
      price,
      previousClose,
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
  const vc = vsCurrency.toLowerCase();
  // include_24hr_change gives us the percent delta in the same response —
  // we derive the 24h-ago price as current / (1 + change/100). Zero extra
  // network calls over the simple-price endpoint.
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    coinId,
  )}&vs_currencies=${encodeURIComponent(vc)}&include_24hr_change=true`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;

    const data = await res.json();
    const price = data?.[coinId]?.[vc];
    if (typeof price !== "number") return null;

    const pctChange = data?.[coinId]?.[`${vc}_24h_change`];
    const previousClose =
      typeof pctChange === "number"
        ? price / (1 + pctChange / 100)
        : null;

    return {
      symbol: coinId,
      price,
      previousClose,
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
      previousClose: 1,
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
