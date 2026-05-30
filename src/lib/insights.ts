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
  /** Headline statistic for the visual lift, e.g. "82%" or "50%". */
  stat: string | null;
  /** Short caption that reads after the stat, e.g. "is one bet — your stocks and crypto move together". Concatenated with `stat` forms the natural sentence. */
  headline: string;
  /** One-line supporting context, ~10–15 words. */
  detail: string;
};

export type DrawdownScenario = {
  positionName: string;
  dropPct: number; // e.g. 0.35 for a 35% drop
  netWorthImpactPct: number; // net-worth loss as a fraction, e.g. 0.16
  valueLost: number; // absolute base-currency value lost (caller formats)
};

/**
 * Multi-shock stress matrix: single-name, sector, and macro-correlated shocks.
 * The asymmetry the panel surfaces — a single-name shock is bounded by one
 * position's weight; a correlated shock hits the whole cluster at once.
 */
export type Scenario = {
  /** Human-readable label, e.g. "Tesla Inc −35%". */
  label: string;
  kind: "single_name" | "sector" | "macro";
  /** Fraction of NAV exposed to the shock (e.g. 0.5 for 50%). */
  positionPct: number;
  /** Shock magnitude (e.g. 0.35 for a 35% drop). */
  shockPct: number;
  /** Resulting NAV loss as a fraction (positionPct × shockPct). */
  impactPct: number;
  /** Absolute base-currency loss (caller formats). */
  valueLost: number;
};

/**
 * Templated recommendation derived from the lead finding. Bold runs in `text`
 * are wrapped in **double asterisks** for inline emphasis in the panel.
 * Phrased as structural rules (caps, timeframes, behavioral guardrails), not
 * specific buy/sell calls — keeps the engine on the right side of "advice".
 */
export type Move = {
  text: string;
  coda: string;
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
  /** Severity-derived 0–5 score for the panel's risk meter. */
  riskLevel: number;
  /** Stress scenarios in priority order: single-name, sector, macro. */
  scenarios: Scenario[];
  /** Templated recommendation derived from the lead finding's kind. */
  move: Move | null;
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
      riskLevel: 0,
      scenarios: [],
      move: null,
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
      stat: pct(riskOnPct),
      headline: "is one bet — your stocks and crypto move together",
      detail:
        "US growth tech and crypto ride the same liquidity. Splitting asset classes isn't diversification here.",
    });
  }

  // Many names, top 3 dominate. Suppressed when one-bet already fired, since
  // that finding says the same thing harder.
  const top3Pct = positions.slice(0, 3).reduce((s, p) => s + p.pct, 0);
  if (!oneBetFired && positions.length >= 5 && top3Pct >= TOP3_ILLUSION) {
    findings.push({
      kind: "diversification_illusion",
      severity: "high",
      stat: pct(top3Pct),
      headline: "is your top 3 holdings — the rest is rounding error",
      detail: "You're less diversified than the position count suggests.",
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
      stat: pct(largest.pct),
      headline: `is ${largest.name}`,
      detail: severe
        ? isCrypto
          ? "One bad week for this token is a bad year for your net worth."
          : "One bad quarter for this company is a bad year for your net worth."
        : isCrypto
          ? "Net worth moves with one coin's story, not the market's."
          : "Net worth moves with one company's story, not the market's.",
    });
  }

  // AI/semis as a named factor — the specific version of the one-bet story.
  const aiSemis = factors.find((f) => f.factor === "ai_semis");
  if (aiSemis && aiSemis.pct >= AI_SEMIS_THRESHOLD) {
    findings.push({
      kind: "factor_concentration",
      severity: "elevated",
      stat: pct(aiSemis.pct),
      headline: "is the AI and semiconductor trade",
      detail: `${aiSemis.names.slice(0, 3).join(", ")} are one story. If AI capex cools, this block moves as a unit.`,
    });
  }

  // Volatile crypto only — stablecoins are excluded (they're cash-like).
  const cryptoPct = factors.find((f) => f.factor === "crypto")?.pct ?? 0;
  if (cryptoPct >= CRYPTO_ELEVATED) {
    findings.push({
      kind: "crypto_heavy",
      severity: cryptoPct >= CRYPTO_HIGH ? "high" : "elevated",
      stat: pct(cryptoPct),
      headline: "is crypto",
      detail: "A normal crypto week moves this much of your wealth. Make sure that's a choice.",
    });
  }

  const stablePct = factors.find((f) => f.factor === "stablecoin")?.pct ?? 0;
  if (stablePct >= STABLECOIN_NOTE) {
    findings.push({
      kind: "stablecoin_buffer",
      severity: "info",
      stat: pct(stablePct),
      headline: "is stablecoins — cash-like, not crypto risk",
      detail: "Useful dry powder. Count it as cash, not the volatile bet 'crypto' implies.",
    });
  }

  const cashPct = byClass.find((c) => c.assetClass === "cash")?.pct ?? 0;
  if (cashPct >= CASH_DRAG) {
    findings.push({
      kind: "cash_drag",
      severity: "info",
      stat: pct(cashPct),
      headline: "is sitting in cash",
      detail: "Intent (dry powder) or inertia losing to inflation? Worth knowing which.",
    });
  }

  const rank: Record<Severity, number> = { high: 0, elevated: 1, info: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

  // Dedup: when the lead isn't single_name, the stress test below names the
  // largest position — a secondary single_name about the same position adds
  // nothing new. Drop it so the same name doesn't appear twice in the panel.
  if (findings[0]?.kind !== "single_name") {
    for (let i = findings.length - 1; i > 0; i--) {
      if (findings[i].kind === "single_name") findings.splice(i, 1);
    }
  }

  // Stress scenarios — three flavors of shock. The single-name is the existing
  // one; sector and macro expose the cost the position view hides (a
  // correlated cluster moves together, so the macro shock is often the biggest
  // even though no single position drops that much).
  const scenarios: Scenario[] = [];

  if (largest.assetClass !== "cash" && !largestIsStable) {
    scenarios.push({
      label: `${largest.name} −35%`,
      kind: "single_name",
      positionPct: largest.pct,
      shockPct: SCENARIO_DROP,
      impactPct: largest.pct * SCENARIO_DROP,
      valueLost: largest.value * SCENARIO_DROP,
    });
  }

  const cryptoFactorEntry = factors.find((f) => f.factor === "crypto");
  if (cryptoFactorEntry && cryptoFactorEntry.pct >= 0.1) {
    scenarios.push({
      label: "Crypto sector −30%",
      kind: "sector",
      positionPct: cryptoFactorEntry.pct,
      shockPct: 0.3,
      impactPct: cryptoFactorEntry.pct * 0.3,
      valueLost: cryptoFactorEntry.value * 0.3,
    });
  }

  if (riskOnPct >= 0.4) {
    scenarios.push({
      label: "Risk-on macro −25% (liquidity event)",
      kind: "macro",
      positionPct: riskOnPct,
      shockPct: 0.25,
      impactPct: riskOnPct * 0.25,
      valueLost: riskOnValue * 0.25,
    });
  }

  // Severity-derived 0–5 risk score for the meter. Each high finding adds 2,
  // each elevated adds 1, info adds 0. Capped at 5.
  const riskScore = findings.reduce(
    (s, f) =>
      s + (f.severity === "high" ? 2 : f.severity === "elevated" ? 1 : 0),
    0,
  );
  const riskLevel = Math.min(5, riskScore);

  const lead = findings[0] ?? null;
  const move: Move | null = lead ? buildMove(lead, largest) : null;

  return {
    netWorth,
    positionCount: positions.length,
    byClass,
    positions,
    factors,
    findings,
    headline: lead,
    riskLevel,
    scenarios,
    move,
  };
}

/**
 * Templated recommendation per finding kind. Phrased as structural rules
 * (position caps, cluster caps, behavioral pre-commitments) — never as
 * specific buy/sell calls. Returns null for info-level findings where there's
 * nothing to act on (stablecoin_buffer, cash_drag).
 */
function buildMove(
  headline: Finding,
  largest: { name: string },
): Move | null {
  switch (headline.kind) {
    case "one_bet":
      return {
        text: `Bring **${largest.name} to ≤35%** and the risk-on cluster to **≤70%** over the next 90 days. Trim mechanically on strength — **pre-commit the amount now**, before the position rallies again. Sweep proceeds to cash or an uncorrelated bucket, not into another tech name.`,
        coda: `The fix is structural, not predictive. You're not betting against ${largest.name} — you're refusing to let any single name run your net worth.`,
      };
    case "single_name":
      return {
        text: `Bring **${largest.name} to ≤35%** over the next 90 days. Trim mechanically on strength — **pre-commit the amount now**. Sweep proceeds to cash or an uncorrelated bucket, not into a correlated name.`,
        coda: `Cap any single position at 40% and stick to it. The fix is structural, not predictive.`,
      };
    case "diversification_illusion":
      return {
        text: `Cap any single position at **≤40%** and your top-3 at **≤70%**. Trim mechanically over 90 days — start with the largest.`,
        coda: `Diversification is a count plus a distribution. The count is fine; the distribution isn't.`,
      };
    case "crypto_heavy":
      return {
        text: `Cap crypto exposure at **≤30%** of net worth. Trim mechanically over 90 days into a defensive bucket — cash or stablecoins, not another high-beta name.`,
        coda: `Crypto is a position-size question, not a market call. Set the cap once.`,
      };
    case "factor_concentration":
      return {
        text: `Cap AI/semis exposure at **≤25%** of net worth. Trim names already concentrated; route new capital to uncorrelated buckets.`,
        coda: `AI is a real trend and a single factor. Both are true at once.`,
      };
    default:
      return null;
  }
}
