import { NextResponse, type NextRequest } from "next/server";
import { etfLogoUrl } from "@/lib/etf-logos";
import { fetchFinnhubProfile } from "@/lib/prices";

/**
 * Unified search endpoint for the add-asset autocomplete.
 *
 *   GET /api/search?q=tesla&class=equity  → Yahoo
 *   GET /api/search?q=btc&class=crypto    → CoinGecko
 *
 * Normalizes both shapes into a single SearchResult schema the client can
 * render the same way. Cached 5 minutes server-side so rapid typing doesn't
 * spam upstream.
 *
 * Upstream shape samples:
 *   Yahoo:     { quotes: [{ symbol, shortname, longname, exchDisp, quoteType }] }
 *   CoinGecko: { coins:  [{ id, symbol, name, thumb, market_cap_rank }] }
 */

export type SearchResult = {
  symbol: string;      // The ticker / display symbol (e.g. "TSLA", "BTC")
  name: string;        // Human name (e.g. "Tesla, Inc.", "Bitcoin")
  externalId: string;  // Provider lookup key — for Finnhub = symbol, for
                       // CoinGecko = slug. Sent back to addAsset as-is.
  source: "finnhub" | "coingecko";
  exchange: string | null;  // Where it trades. Null for crypto.
  thumb: string | null;     // Optional icon URL (CoinGecko provides these).
  /**
   * Normalized asset class. Set from Finnhub's `type` field so the UI can
   * collapse the Stock/ETF distinction but we still record the right value
   * in the DB.
   *   Common Stock / ADR → "equity"
   *   ETP / ETF          → "etf"
   *   crypto always      → "crypto"
   */
  assetClass: "equity" | "etf" | "crypto";
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const klass = request.nextUrl.searchParams.get("class") ?? "equity";

  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const results =
      klass === "crypto" ? await searchCoinGecko(q) : await searchFinnhub(q);
    return NextResponse.json({ results: results.slice(0, 8) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}

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

  // Prefer equity + ETF types; drop warrants, rights, preferreds.
  const allowedTypes = new Set(["Common Stock", "ETP", "ETF", "ADR"]);

  // Derive an exchange label from the symbol suffix so the UI can show it.
  const EX_NAME: Record<string, string> = {
    HK: "HKEX",
    L: "LSE",
    T: "TSE",
    TO: "TSX", V: "TSX‑V",
    DE: "XETRA",
    PA: "Euronext",
    AS: "Euronext",
    MI: "Borsa IT",
    MC: "BME",
    SW: "SIX",
    ST: "Nasdaq Stockholm",
    CO: "Nasdaq Copenhagen",
    OL: "Oslo",
    AX: "ASX",
    NZ: "NZX",
    SI: "SGX",
    KS: "KRX", KQ: "KOSDAQ",
    SS: "SSE", SZ: "SZSE",
    NS: "NSE", BO: "BSE",
    SA: "B3",
    MX: "BMV",
    JK: "IDX",
    BK: "SET",
    TW: "TWSE",
    F: "Frankfurt", MU: "München", DU: "Düsseldorf", BR: "Euronext",
  };

  // Top candidates only — we hit profile2 per result to resolve a logo,
  // and Finnhub's free tier is 60 rpm. Capping at 8 keeps bursts safe;
  // each profile2 response caches for 24h via Next's fetch cache, so
  // repeat searches are free.
  const filtered = raw
    .filter((r) => r.symbol && (!r.type || allowedTypes.has(r.type)))
    .slice(0, 8);

  // Kick off profile fetches in parallel. These give us real logos (Tesla
  // red, NVIDIA green, Circle's cyan-purple). The fetchFinnhubProfile
  // helper already does the "no logo → Google-favicon-via-weburl" fallback,
  // so long-tail tickers without a Finnhub logo still get something.
  const profiles = await Promise.all(
    filtered.map((r) =>
      fetchFinnhubProfile(r.symbol!).catch(() => null),
    ),
  );

  return filtered.map((r, i) => {
    const sym = (r.displaySymbol ?? r.symbol)!;
    const parts = sym.split(".");
    const suffix = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
    const exchange = suffix ? EX_NAME[suffix] ?? suffix : "US";
    const isEtf = r.type === "ETP" || r.type === "ETF";

    // Thumb priority: Finnhub profile's logo (or its own favicon fallback)
    // → ETF issuer map → null. Curated map acts as a safety net for ETFs
    // whose profile2 response is empty.
    const thumb =
      profiles[i]?.logo ??
      etfLogoUrl(r.symbol!) ??
      etfLogoUrl(sym) ??
      null;

    return {
      symbol: sym,
      name: r.description ?? sym,
      externalId: r.symbol!, // Finnhub wants the RAW symbol for /quote
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
