/**
 * Concentration insight engine — pure, dependency-free analysis of a holdings
 * snapshot. The thesis: people believe they're diversified, then discover their
 * net worth rides on one name, one asset class, or one worldview. This computes
 * the read that produces that realization from current holdings alone — no price
 * history, no behavioral data — so it works on a brand-new user's first session.
 *
 * Findings are expressed in percentages and counts (locale/currency-free); the
 * caller formats any absolute amounts using its own currency context.
 */

export type AssetClass = "equity" | "etf" | "crypto" | "cash";

export type Holding = {
  name: string;
  symbol: string | null;
  assetClass: AssetClass;
  /** Current value already converted to the user's base currency. */
  valueBase: number;
};

export type Severity = "info" | "elevated" | "high";

export type Finding = {
  kind:
    | "one_bet"
    | "factor_concentration"
    | "diversification_illusion"
    | "single_name"
    | "crypto_heavy"
    | "stablecoin_buffer"
    | "cash_drag";
  severity: Severity;
  /** One-line, percentage-based headline, safe to render as-is. */
  headline: string;
  /** Supporting sentence — the "so what". */
  detail: string;
};

export type DrawdownScenario = {
  positionName: string;
  dropPct: number; // e.g. 0.35 for a 35% drop
  netWorthImpactPct: number; // net-worth loss as a fraction, e.g. 0.16
  valueLost: number; // absolute base-currency value lost (caller formats)
};

/** A macro factor a holding loads on, used to detect hidden correlation. */
export type Factor =
  | "ai_semis"
  | "us_growth_tech"
  | "china_tech"
  | "crypto"
  | "stablecoin"
  | "cash"
  | "other";

export type FactorExposure = {
  factor: Factor;
  value: number;
  pct: number;
  assetClasses: AssetClass[];
  names: string[];
};

export type ConcentrationReport = {
  netWorth: number;
  positionCount: number;
  byClass: { assetClass: AssetClass; value: number; pct: number }[];
  positions: {
    name: string;
    symbol: string | null;
    assetClass: AssetClass;
    value: number;
    pct: number;
  }[];
  factors: FactorExposure[];
  findings: Finding[];
  /** The single most important finding to lead with, or null if balanced. */
  headline: Finding | null;
  scenario: DrawdownScenario | null;
};

// Thresholds encode a judgment call, not a law. A single position above ~20% of
// net worth is the line where diversification advice stops calling you
// diversified; 40%+ means the outcome IS that one bet. Crypto bands reflect its
// volatility — a 30%+ weight already swings net worth meaningfully in a normal
// week. These are the levers to tune once real users react to them.
const SINGLE_NAME_ELEVATED = 0.2;
const SINGLE_NAME_HIGH = 0.4;
const CRYPTO_ELEVATED = 0.3;
const CRYPTO_HIGH = 0.5;
const TOP3_ILLUSION = 0.6;
const CASH_DRAG = 0.3;
const SCENARIO_DROP = 0.35;

// ---------------------------------------------------------------------------
// Hidden-correlation / "financial DNA" — rules-based factor classification.
// A portfolio can look diversified (many names, stocks AND crypto) while most
// of it rides one macro factor: US growth tech and crypto have tracked each
// other on liquidity and risk appetite for years. "Stocks plus crypto" is often
// a single bet wearing two hats. This finds that without an LLM. Maps are kept
// small and high-confidence; unknown tickers stay "other" rather than inflate a
// one-bet claim we can't defend. Stablecoins are treated as cash-like, not
// volatile crypto.
// ---------------------------------------------------------------------------

const ONE_BET_THRESHOLD = 0.6;
const AI_SEMIS_THRESHOLD = 0.35;
const STABLECOIN_NOTE = 0.15;

const AI_SEMIS = new Set([
  "NVDA", "AMD", "AVGO", "TSM", "SMH", "SOXX", "SOXL", "ASML", "MU",
  "ARM", "MRVL", "QCOM", "INTC", "TXN", "LRCX", "AMAT", "KLAC",
]);

const US_GROWTH_TECH = new Set([
  "AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "TSLA", "NFLX",
  "CRM", "ADBE", "ORCL", "NOW", "SHOP", "UBER", "ABNB", "PLTR",
  "COIN", "HOOD", "SQ", "BLOCK", "PYPL", "SNOW", "DDOG", "NET",
  "QQQ", "QQQM", "VGT", "XLK", "ARKK", "MAGS",
]);

const CHINA_TECH = new Set([
  "0700.HK", "0700", "BABA", "9988.HK", "JD", "PDD", "BIDU", "NIO",
  "3690.HK", "1810.HK", "9618.HK",
]);

const STABLECOINS = new Set([
  "USDT", "USDC", "DAI", "BUSD", "TUSD", "USDE", "FDUSD", "PYUSD",
  "USDP", "GUSD", "LUSD", "FRAX",
]);

const RISK_ON = new Set<Factor>(["ai_semis", "us_growth_tech", "crypto"]);

function classify(p: {
  symbol: string | null;
  assetClass: AssetClass;
}): Factor[] {
  const sym = (p.symbol ?? "").toUpperCase().trim();
  if (p.assetClass === "cash") return ["cash"];
  if (p.assetClass === "crypto") {
    return STABLECOINS.has(sym) ? ["stablecoin"] : ["crypto"];
  }
  const tags: Factor[] = [];
  if (AI_SEMIS.has(sym)) tags.push("ai_semis");
  if (US_GROWTH_TECH.has(sym) || AI_SEMIS.has(sym)) tags.push("us_growth_tech");
  if (CHINA_TECH.has(sym)) tags.push("china_tech");
  return tags.length ? tags : ["other"];
}

export function analyzeConcentration(holdings: Holding[]): ConcentrationReport {
  const valued = holdings.filter((h) => h.valueBase > 0);
  const netWorth = valued.reduce((sum, h) => sum + h.valueBase, 0);

  if (netWorth <= 0 || valued.length === 0) {
    return {
      netWorth: 0,
      positionCount: 0,
      byClass: [],
      positions: [],
      factors: [],
      findings: [],
      headline: null,
      scenario: null,
    };
  }

  const positions = valued
    .map((h) => ({
      name: h.name,
      symbol: h.symbol,
      assetClass: h.assetClass,
      value: h.valueBase,
      pct: h.valueBase / netWorth,
    }))
    .sort((a, b) => b.value - a.value);

  const classMap = new Map<AssetClass, number>();
  for (const p of positions) {
    classMap.set(p.assetClass, (classMap.get(p.assetClass) ?? 0) + p.value);
  }
  const byClass = [...classMap.entries()]
    .map(([assetClass, value]) => ({ assetClass, value, pct: value / netWorth }))
    .sort((a, b) => b.value - a.value);

  // --- Factor / hidden-correlation analysis ---
  const factorMap = new Map<
    Factor,
    { value: number; classes: Set<AssetClass>; names: string[] }
  >();
  for (const p of positions) {
    for (const f of classify(p)) {
      const e = factorMap.get(f) ?? {
        value: 0,
        classes: new Set<AssetClass>(),
        names: [],
      };
      e.value += p.value;
      e.classes.add(p.assetClass);
      e.names.push(p.name);
      factorMap.set(f, e);
    }
  }
  const factors: FactorExposure[] = [...factorMap.entries()]
    .map(([factor, e]) => ({
      factor,
      value: e.value,
      pct: e.value / netWorth,
      assetClasses: [...e.classes],
      names: e.names,
    }))
    .sort((a, b) => b.value - a.value);

  // Risk-on "one bet": US growth tech + crypto load on the same liquidity
  // factor. Counted once per holding (a name tagged both ai_semis and
  // us_growth_tech is not double-counted).
  const riskOn = positions.filter((p) =>
    classify(p).some((f) => RISK_ON.has(f)),
  );
  const riskOnValue = riskOn.reduce((s, p) => s + p.value, 0);
  const riskOnPct = riskOnValue / netWorth;
  const riskOnClasses = new Set(riskOn.map((p) => p.assetClass));
  const spansStocksAndCrypto =
    riskOnClasses.has("crypto") &&
    (riskOnClasses.has("equity") || riskOnClasses.has("etf"));

  const findings: Finding[] = [];
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  // Headline insight: looks diversified, actually one macro bet.
  const oneBetFired =
    riskOnPct >= ONE_BET_THRESHOLD && spansStocksAndCrypto && riskOn.length >= 4;
  if (oneBetFired) {
    findings.push({
      kind: "one_bet",
      severity: "high",
      headline: `You hold ${positions.length} positions across stocks and crypto, but ${pct(riskOnPct)} of your net worth is one bet: risk-on tech and liquidity.`,
      detail:
        "US growth tech and crypto rise and fall on the same thing, risk appetite and liquidity. When the macro turns, your stocks and your coins drop together. Splitting across asset classes is not the diversification it looks like.",
    });
  }

  // Many names, top 3 dominate. Suppressed when one-bet already fired, since
  // that finding says the same thing harder.
  const top3Pct = positions.slice(0, 3).reduce((s, p) => s + p.pct, 0);
  if (!oneBetFired && positions.length >= 5 && top3Pct >= TOP3_ILLUSION) {
    findings.push({
      kind: "diversification_illusion",
      severity: "high",
      headline: `You hold ${positions.length} positions, but your top 3 are ${pct(top3Pct)} of your net worth.`,
      detail:
        "The long tail is rounding error. Your outcome is decided by a handful of names — you're less diversified than the count suggests.",
    });
  }

  const largest = positions[0];
  const largestIsStable = classify(largest).includes("stablecoin");
  // Stablecoins are cash-like; a big one is a buffer, not single-name risk, so
  // it is handled by the stablecoin finding below, not here.
  if (!largestIsStable && largest.pct >= SINGLE_NAME_ELEVATED) {
    const severe = largest.pct >= SINGLE_NAME_HIGH;
    const isCrypto = largest.assetClass === "crypto";
    findings.push({
      kind: "single_name",
      severity: severe ? "high" : "elevated",
      headline: `${largest.name} is ${pct(largest.pct)} of everything you own.`,
      detail: severe
        ? isCrypto
          ? "This isn't a position, it's your whole thesis. One bad week for this token is a bad year for your net worth."
          : "This isn't a position, it's the whole thesis. One company's bad quarter is your bad year."
        : isCrypto
          ? "A token this size means your net worth moves with one coin's story more than the market's."
          : "A name this size means your net worth tracks one company's story more than the market's.",
    });
  }

  // AI/semis as a named factor — the specific version of the one-bet story.
  const aiSemis = factors.find((f) => f.factor === "ai_semis");
  if (aiSemis && aiSemis.pct >= AI_SEMIS_THRESHOLD) {
    findings.push({
      kind: "factor_concentration",
      severity: "elevated",
      headline: `${pct(aiSemis.pct)} of your net worth is the AI and semiconductor trade specifically.`,
      detail: `${aiSemis.names.slice(0, 3).join(", ")} are one story. If the AI capex cycle cools, this block moves as a unit.`,
    });
  }

  // Volatile crypto only — stablecoins are excluded (they're cash-like).
  const cryptoPct = factors.find((f) => f.factor === "crypto")?.pct ?? 0;
  if (cryptoPct >= CRYPTO_ELEVATED) {
    findings.push({
      kind: "crypto_heavy",
      severity: cryptoPct >= CRYPTO_HIGH ? "high" : "elevated",
      headline: `Crypto is ${pct(cryptoPct)} of your net worth.`,
      detail:
        "A normal crypto week moves this much of your wealth. Make sure that volatility is a choice, not a surprise.",
    });
  }

  const stablePct = factors.find((f) => f.factor === "stablecoin")?.pct ?? 0;
  if (stablePct >= STABLECOIN_NOTE) {
    findings.push({
      kind: "stablecoin_buffer",
      severity: "info",
      headline: `${pct(stablePct)} of your holdings are stablecoins — cash-like, not crypto risk.`,
      detail:
        "Useful dry powder, but not the volatile bet 'crypto' implies. Count it as cash when you judge your real exposure.",
    });
  }

  const cashPct = byClass.find((c) => c.assetClass === "cash")?.pct ?? 0;
  if (cashPct >= CASH_DRAG) {
    findings.push({
      kind: "cash_drag",
      severity: "info",
      headline: `${pct(cashPct)} of your net worth is sitting in cash.`,
      detail:
        "Sometimes that's intent (dry powder); sometimes it's inertia losing to inflation. Worth knowing which.",
    });
  }

  const rank: Record<Severity, number> = { high: 0, elevated: 1, info: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

  // Stress the largest volatile position. Skip cash and stablecoins — they do
  // not crater 35% in a day, so a scenario on them would be nonsense.
  const scenario: DrawdownScenario | null =
    largest.assetClass !== "cash" && !largestIsStable
      ? {
          positionName: largest.name,
          dropPct: SCENARIO_DROP,
          netWorthImpactPct: largest.pct * SCENARIO_DROP,
          valueLost: largest.value * SCENARIO_DROP,
        }
      : null;

  return {
    netWorth,
    positionCount: positions.length,
    byClass,
    positions,
    factors,
    findings,
    headline: findings[0] ?? null,
    scenario,
  };
}
