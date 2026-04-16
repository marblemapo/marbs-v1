import { NextResponse, type NextRequest } from "next/server";

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

  return raw
    .filter((r) => r.symbol && (!r.type || allowedTypes.has(r.type)))
    .map((r) => {
      const sym = (r.displaySymbol ?? r.symbol)!;
      const parts = sym.split(".");
      const suffix = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
      const exchange = suffix ? EX_NAME[suffix] ?? suffix : "US";
      return {
        symbol: sym,
        name: r.description ?? sym,
        externalId: r.symbol!, // Finnhub wants the RAW symbol for /quote
        source: "finnhub" as const,
        exchange,
        thumb: null,
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
    }));
}
