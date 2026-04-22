/**
 * ETF ticker → issuer domain map.
 *
 * Finnhub's free tier rarely returns logos for ETFs, and many don't have a
 * `weburl` we can hand to Clearbit. A curated mapping of the top ~100 ETFs
 * to their issuer's domain gets us the right brand logo (iShares orange,
 * Vanguard red, etc) without per-ticker custom assets.
 *
 * When we find a match we build a Clearbit logo URL from the issuer
 * domain. Covers the 80% of retail portfolios. Unknown tickers fall
 * through to the initials badge.
 */

// Issuer domains — Clearbit resolves these to crisp brand logos.
const VANGUARD = "vanguard.com";
const ISHARES = "ishares.com";
const SSGA = "ssga.com"; // State Street — SPY, DIA, etc.
const INVESCO = "invesco.com";
const SCHWAB = "schwab.com";
const ARK = "ark-funds.com";
const FIDELITY = "fidelity.com";
const WISDOMTREE = "wisdomtree.com";
const FIRSTTRUST = "ftportfolios.com";
const JPM = "jpmorgan.com";
const PIMCO = "pimco.com";
const VANECK = "vaneck.com";
const GLOBALX = "globalxetfs.com";
const DIREXION = "direxion.com";
const PROSHARES = "proshares.com";
const INVESCO_QQQ = "invesco.com";

const ETF_ISSUER: Record<string, string> = {
  // --- State Street (SPDR) ---
  SPY: SSGA, DIA: SSGA, MDY: SSGA, SPLG: SSGA, XLK: SSGA, XLF: SSGA,
  XLE: SSGA, XLV: SSGA, XLY: SSGA, XLP: SSGA, XLI: SSGA, XLU: SSGA,
  XLB: SSGA, XLRE: SSGA, XLC: SSGA, GLD: SSGA, SLV: SSGA,

  // --- Vanguard ---
  VOO: VANGUARD, VTI: VANGUARD, VXUS: VANGUARD, VEA: VANGUARD, VWO: VANGUARD,
  VIG: VANGUARD, VGT: VANGUARD, VYM: VANGUARD, VB: VANGUARD, VO: VANGUARD,
  BND: VANGUARD, BNDX: VANGUARD, BSV: VANGUARD, VCIT: VANGUARD, VCSH: VANGUARD,
  VT: VANGUARD, VEU: VANGUARD, VUG: VANGUARD, VTV: VANGUARD, VPL: VANGUARD,
  VGK: VANGUARD, VBR: VANGUARD, VBK: VANGUARD, VNQ: VANGUARD, VDE: VANGUARD,
  "VWRL.L": VANGUARD, "VUSA.L": VANGUARD, "VUAA.L": VANGUARD,

  // --- iShares (BlackRock) ---
  IVV: ISHARES, IWM: ISHARES, IWD: ISHARES, IWF: ISHARES, IWB: ISHARES,
  EFA: ISHARES, EEM: ISHARES, AGG: ISHARES, TLT: ISHARES, IEF: ISHARES,
  SHY: ISHARES, LQD: ISHARES, HYG: ISHARES, IEMG: ISHARES, IEFA: ISHARES,
  IAU: ISHARES, ITOT: ISHARES, IJH: ISHARES, IJR: ISHARES, IVW: ISHARES,
  IVE: ISHARES, IBIT: ISHARES,

  // --- Invesco ---
  QQQ: INVESCO_QQQ, QQQM: INVESCO_QQQ, SPHD: INVESCO, RSP: INVESCO,

  // --- Schwab ---
  SCHD: SCHWAB, SCHX: SCHWAB, SCHF: SCHWAB, SCHB: SCHWAB, SCHE: SCHWAB,
  SCHG: SCHWAB, SCHV: SCHWAB, SCHA: SCHWAB, SCHM: SCHWAB, SCHP: SCHWAB,
  SCHZ: SCHWAB, SCHY: SCHWAB,

  // --- Ark Invest ---
  ARKK: ARK, ARKQ: ARK, ARKW: ARK, ARKG: ARK, ARKF: ARK, ARKX: ARK,

  // --- Fidelity ---
  FXAIX: FIDELITY, FSKAX: FIDELITY, FZROX: FIDELITY, FTEC: FIDELITY,
  FBND: FIDELITY, FBTC: FIDELITY,

  // --- WisdomTree ---
  DGRW: WISDOMTREE, HEDJ: WISDOMTREE, DXJ: WISDOMTREE,

  // --- First Trust ---
  FDN: FIRSTTRUST, FV: FIRSTTRUST, SKYY: FIRSTTRUST,

  // --- JPMorgan ---
  JEPI: JPM, JEPQ: JPM, JPST: JPM,

  // --- PIMCO ---
  MINT: PIMCO, BOND: PIMCO,

  // --- VanEck ---
  MOAT: VANECK, SMH: VANECK,

  // --- Global X ---
  SPXL: GLOBALX, QYLD: GLOBALX, SRLN: GLOBALX, JETS: GLOBALX,

  // --- Direxion / ProShares (leveraged / inverse) ---
  TQQQ: PROSHARES, SQQQ: PROSHARES, UPRO: PROSHARES, SPXU: PROSHARES,
  SOXL: DIREXION, TECL: DIREXION, SPXS: DIREXION,

  // --- Crypto ETFs ---
  GBTC: "grayscale.com",
  ETHE: "grayscale.com",
  FETH: FIDELITY,
  ARKB: ARK,
};

/**
 * Logo URL for a ticker, or null. Handles exchange-suffixed tickers (VWRL.L)
 * by checking the raw string first, then falling back to the pre-suffix part
 * — this lets a single entry cover both "VOO" and hypothetical "VOO.*"
 * listings without enumerating every exchange.
 */
export function etfLogoUrl(ticker: string): string | null {
  const upper = ticker.trim().toUpperCase();
  const domain = ETF_ISSUER[upper] ?? ETF_ISSUER[upper.split(".")[0]];
  return domain ? `https://logo.clearbit.com/${domain}` : null;
}
