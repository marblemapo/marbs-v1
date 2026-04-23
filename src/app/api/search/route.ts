import { NextResponse, type NextRequest } from "next/server";
import { etfLogoUrl } from "@/lib/etf-logos";
import { fetchFinnhubProfile } from "@/lib/prices";

/**
 * Unified search endpoint for the add-asset autocomplete.
 *
 *   GET /api/search?q=tesla&class=equity  → Yahoo Finance
 *   GET /api/search?q=0700&class=equity   → Yahoo Finance (HKEX, TSE, etc)
 *   GET /api/search?q=btc&class=crypto    → CoinGecko
 *
 * Stock search uses Yahoo Finance (not Finnhub) because Finnhub's free tier
 * /search is US-biased and skips most HKEX / LSE / TSE / SZSE tickers.
 * Yahoo covers every global exchange including the full ~2,600-row HK
 * universe, resolves Chinese names, and returns `exchDisp` we can use to
 * tag the row. Unofficial API but stable for a decade.
 *
 * Logos still come from Finnhub's profile2 — it does cover HK tickers
 * (0700.HK resolves to Tencent's profile with a logo), and for anything
 * Finnhub doesn't have, we fall through to the Google-favicon-via-weburl
 * chain inside `fetchFinnhubProfile`.
 */

export type SearchResult = {
  symbol: string;      // The ticker / display symbol (e.g. "TSLA", "0700.HK")
  name: string;        // Human name (e.g. "Tesla, Inc.", "Tencent Holdings Limited")
  externalId: string;  // Provider lookup key — full suffixed ticker for Yahoo/Finnhub
                       // (e.g. "0700.HK"), slug for CoinGecko. Sent back to addAsset.
  source: "finnhub" | "coingecko";
  exchange: string | null;  // Display label. "HKEX", "NASDAQ", etc. Null for crypto.
  thumb: string | null;     // Optional icon URL.
  /**
   * Normalized asset class.
   *   Yahoo EQUITY / other → "equity"
   *   Yahoo ETF            → "etf"
   *   crypto always        → "crypto"
   */
  assetClass: "equity" | "etf" | "crypto";
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const klass = request.nextUrl.searchParams.get("class") ?? "equity";

  if (q.length < 1) return NextResponse.json({ results: [] });

  try {
    const results =
      klass === "crypto" ? await searchCoinGecko(q) : await searchStocks(q);
    return NextResponse.json({ results: results.slice(0, 8) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}

/**
 * Primary: Yahoo (global coverage, no key).
 * Fallback: Finnhub (US-biased but auth-keyed and always reachable).
 *
 * Yahoo's finance endpoints occasionally block server-side requests from
 * specific IP ranges (Vercel's serverless, Cloudflare Workers, etc). When
 * that happens an empty array would hide every ticker — so if Yahoo returns
 * nothing, we retry against Finnhub before giving up.
 */
async function searchStocks(q: string): Promise<SearchResult[]> {
  const yahoo = await searchYahoo(q).catch(() => [] as SearchResult[]);
  if (yahoo.length > 0) return yahoo;
  return searchFinnhub(q).catch(() => [] as SearchResult[]);
}

const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Yahoo's exchange display strings are a bit rough ("HKSE", "TAI") — normalize
 * to the labels retail users recognize.
 */
const EXCH_NORMALIZE: Record<string, string> = {
  HKSE: "HKEX",
  NMS: "NASDAQ",
  NYQ: "NYSE",
  NGM: "NASDAQ",
  NCM: "NASDAQ",
  PCX: "NYSE Arca",
  ASE: "NYSE American",
  LSE: "LSE",
  TAI: "TWSE",
  TWO: "TPEx",
  SHH: "SSE",
  SHZ: "SZSE",
  TYO: "TSE",
  JPX: "TSE",
  KSC: "KRX",
  KOE: "KOSDAQ",
  ASX: "ASX",
  SES: "SGX",
  BSE: "BSE",
  NSI: "NSE",
  SAO: "B3",
  MEX: "BMV",
  GER: "XETRA",
  TOR: "TSX",
  VAN: "TSX-V",
};

async function searchYahoo(q: string): Promise<SearchResult[]> {
  // quotesCount=20 gives Yahoo room to surface non-US listings before
  // trimming to our top-8. `region=US` keeps ranking stable across users.
  const url =
    `https://query2.finance.yahoo.com/v1/finance/search` +
    `?q=${encodeURIComponent(q)}` +
    `&quotesCount=20&newsCount=0&lang=en-US&region=US`;

  const res = await fetch(url, {
    headers: { "User-Agent": YAHOO_UA },
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];

  type YQ = {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;       // short code: NMS, HKSE, TAI
    exchDisp?: string;       // display name: "NasdaqGS", "HKSE"
    quoteType?: string;      // "EQUITY" | "ETF" | "MUTUALFUND" | "CURRENCY" | ...
    typeDisp?: string;
  };
  const data = await res.json();
  const quotes: YQ[] = data?.quotes ?? [];

  // Keep only tradeable equities + ETFs. Drop currencies, indices, options.
  const kept = quotes.filter((q2) => {
    if (!q2.symbol) return false;
    const t = q2.quoteType?.toUpperCase();
    return t === "EQUITY" || t === "ETF";
  });

  // US-first ranking. Yahoo's native relevance ordering puts LSE/HKEX
  // tickers ahead of NASDAQ ADRs for names like "HSBC" or "alibaba" — most
  // of our users think US-by-default, so bubble US listings to the top.
  //
  // Heuristic: no ticker suffix = US (NYSE/NASDAQ/AMEX). Stable sort so
  // within each bucket we preserve Yahoo's relevance ranking.
  const usBucket: YQ[] = [];
  const intlBucket: YQ[] = [];
  for (const q2 of kept) {
    const sym = q2.symbol!;
    const hasSuffix = sym.includes(".");
    const isUsExchange =
      !hasSuffix ||
      q2.exchange === "NMS" ||
      q2.exchange === "NYQ" ||
      q2.exchange === "NGM" ||
      q2.exchange === "NCM" ||
      q2.exchange === "PCX" ||
      q2.exchange === "ASE";
    (isUsExchange ? usBucket : intlBucket).push(q2);
  }
  const filtered = [...usBucket, ...intlBucket].slice(0, 8);

  // Fan out logo lookups. Finnhub's profile2 cache lives 24h, so repeat
  // searches for common tickers are free. Bounded at 8 per search.
  const profiles = await Promise.all(
    filtered.map((q2) =>
      fetchFinnhubProfile(q2.symbol!).catch(() => null),
    ),
  );

  return filtered.map((q2, i) => {
    const sym = q2.symbol!;
    const exchange = resolveExchange(sym, q2.exchange, q2.exchDisp);
    const isEtf = q2.quoteType?.toUpperCase() === "ETF";

    const thumb =
      profiles[i]?.logo ??
      etfLogoUrl(sym) ??
      etfLogoUrl(sym.split(".")[0]) ??
      null;

    return {
      symbol: sym,
      name: q2.longname || q2.shortname || sym,
      externalId: sym, // Yahoo + Finnhub both accept the suffixed ticker
      source: "finnhub" as const,
      exchange,
      thumb,
      assetClass: (isEtf ? "etf" : "equity") as "equity" | "etf",
    };
  });
}

/**
 * Turn Yahoo's exchange hints into a user-visible label. Priority:
 *   1. Ticker suffix (.HK, .L, .T) — unambiguous
 *   2. Yahoo's normalized code (NMS, HKSE)
 *   3. Yahoo's display string
 *   4. "US" for suffix-less tickers
 */
function resolveExchange(
  symbol: string,
  exchCode: string | undefined,
  exchDisp: string | undefined,
): string {
  const parts = symbol.split(".");
  if (parts.length > 1) {
    const suffix = parts[parts.length - 1].toUpperCase();
    const map: Record<string, string> = {
      HK: "HKEX",
      L: "LSE",
      T: "TSE",
      TO: "TSX",
      V: "TSX-V",
      DE: "XETRA",
      PA: "Euronext",
      AS: "Euronext",
      MI: "Borsa IT",
      MC: "BME",
      SW: "SIX",
      ST: "Nasdaq Stockholm",
      CO: "Nasdaq Copenhagen",
      OL: "Oslo",
      HE: "Nasdaq Helsinki",
      AX: "ASX",
      NZ: "NZX",
      SI: "SGX",
      KS: "KRX",
      KQ: "KOSDAQ",
      SS: "SSE",
      SZ: "SZSE",
      NS: "NSE",
      BO: "BSE",
      SA: "B3",
      MX: "BMV",
      JK: "IDX",
      BK: "SET",
      TW: "TWSE",
      F: "Frankfurt",
      MU: "München",
      DU: "Düsseldorf",
      BR: "Euronext",
    };
    if (map[suffix]) return map[suffix];
  }
  if (exchCode && EXCH_NORMALIZE[exchCode]) return EXCH_NORMALIZE[exchCode];
  if (exchDisp) return exchDisp;
  return "US";
}

/**
 * Finnhub fallback. Used only when Yahoo returns nothing (usually means
 * Yahoo IP-blocked the request). US-biased but reliable — has an auth key,
 * unaffected by the unofficial-API flakiness that hits Yahoo.
 */
async function searchFinnhub(q: string): Promise<SearchResult[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];

  type FH = {
    symbol?: string;
    displaySymbol?: string;
    description?: string;
    type?: string;
  };
  const data = await res.json();
  const raw: FH[] = data?.result ?? [];

  const allowedTypes = new Set(["Common Stock", "ETP", "ETF", "ADR"]);
  const filtered = raw
    .filter((r) => r.symbol && (!r.type || allowedTypes.has(r.type)))
    .slice(0, 8);

  const profiles = await Promise.all(
    filtered.map((r) =>
      fetchFinnhubProfile(r.symbol!).catch(() => null),
    ),
  );

  return filtered.map((r, i) => {
    const sym = (r.displaySymbol ?? r.symbol)!;
    const exchange = resolveExchange(sym, undefined, undefined);
    const isEtf = r.type === "ETP" || r.type === "ETF";
    const thumb =
      profiles[i]?.logo ??
      etfLogoUrl(r.symbol!) ??
      etfLogoUrl(sym) ??
      null;
    return {
      symbol: sym,
      name: r.description ?? sym,
      externalId: r.symbol!,
      source: "finnhub" as const,
      exchange,
      thumb,
      assetClass: (isEtf ? "etf" : "equity") as "equity" | "etf",
    };
  });
}

async function searchCoinGecko(q: string): Promise<SearchResult[]> {
  const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];

  type CG = {
    id?: string;
    symbol?: string;
    name?: string;
    thumb?: string;
    market_cap_rank?: number | null;
  };
  const data = await res.json();
  const coins: CG[] = data?.coins ?? [];

  return coins
    .filter((c) => c.id && c.symbol && c.name)
    .map((c) => ({
      symbol: c.symbol!.toUpperCase(),
      name: c.name!,
      externalId: c.id!, // CoinGecko lookup key = slug
      source: "coingecko" as const,
      exchange: null,
      thumb: c.thumb ?? null,
      assetClass: "crypto" as const,
    }));
}
