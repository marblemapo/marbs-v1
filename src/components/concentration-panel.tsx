import type {
  ConcentrationReport,
  FactorExposure,
  Finding,
  Move,
  Scenario,
} from "@/lib/insights";

type Position = ConcentrationReport["positions"][number];

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Comprehensive concentration read panel — a private-banking-style briefing.
 *
 * Default view: risk meter + lifted stat + caption + one-line narrative. The
 * "Full briefing" disclosure expands into position weights (treemap), factor
 * exposure (bars), the stress matrix (multi-shock), and a templated move.
 *
 * Phase 1: historical concentration trend deferred (needs per-position
 * snapshots not yet in the schema). The disclosure uses native <details> so
 * this stays a server component (no React state, no client bundle cost).
 */
export function ConcentrationPanel({ report }: { report: ConcentrationReport }) {
  if (!report.headline) {
    return <EmptyState />;
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium">
        Insights
      </h2>

      <div className="relative flex flex-col gap-5 p-7 rounded-2xl bg-[#0A0A0A] border border-white/[0.08] overflow-hidden">
        {/* Aqua bloom in the top-left corner — matches the net-worth hero card. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 0% 0%, rgba(127,255,212,0.1), transparent 55%)",
          }}
        />

        <RiskRow level={report.riskLevel} />
        <Lead headline={report.headline} />
        <FullBriefing report={report} />
      </div>
    </section>
  );
}

// ── Empty / balanced state ──────────────────────────────────────

function EmptyState() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium">
        Insights
      </h2>
      <div className="p-7 rounded-2xl bg-[#0A0A0A] border border-white/[0.08]">
        <div className="text-sm text-text-secondary leading-relaxed">
          No single name or class dominates. The moment that changes, you&apos;ll
          see it here.
        </div>
      </div>
    </section>
  );
}

// ── Risk profile row (dot + label + 5-segment meter + n/5) ─────

function RiskRow({ level }: { level: number }) {
  // Tier = label + colors, derived from level. Single source of truth for the
  // dot, the label text, the glow, and the filled-segment color — so the
  // meter and label can never disagree (the old "high label · 2/5" bug).
  const tier: "high" | "elevated" | "low" =
    level >= 4 ? "high" : level >= 2 ? "elevated" : "low";
  const cfg =
    tier === "high"
      ? {
          dot: "bg-[#FF5000]",
          text: "text-[#FF5000]",
          fill: "bg-[#FF5000]",
          glow: "rgba(255,80,0,0.45)",
        }
      : tier === "elevated"
        ? {
            dot: "bg-gold",
            text: "text-gold",
            fill: "bg-gold",
            glow: "rgba(245,197,24,0.4)",
          }
        : {
            dot: "bg-[#7FFFD4]",
            text: "text-[#7FFFD4]",
            fill: "bg-[#7FFFD4]",
            glow: "rgba(127,255,212,0.4)",
          };

  return (
    <div className="relative flex items-center gap-3">
      <span
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`}
        style={{ boxShadow: `0 0 12px ${cfg.glow}` }}
      />
      <span
        className={`font-plex text-[10px] uppercase tracking-[0.18em] font-semibold ${cfg.text}`}
      >
        Risk profile · {tier}
      </span>
      <div
        className="flex gap-[3px] ml-auto"
        aria-label={`risk level ${level} of 5`}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const filled = i < level;
          return (
            <span
              key={i}
              className={`w-5 h-[5px] rounded-[1px] ${filled ? cfg.fill : "bg-white/[0.06]"}`}
            />
          );
        })}
      </div>
      <span className="font-plex text-[10px] tracking-[0.14em] text-text-muted ml-1">
        {level} / 5
      </span>
    </div>
  );
}

// ── Lead area (big stat + caption + narrative) ──────────────────

function Lead({ headline }: { headline: Finding }) {
  return (
    <div className="relative flex flex-col gap-2.5">
      <div className="flex items-baseline gap-3 flex-wrap">
        {headline.stat && (
          <span className="font-display text-3xl font-bold tabular-nums tracking-[-0.03em] leading-none">
            {headline.stat}
          </span>
        )}
        <span className="text-base text-text-secondary leading-snug">
          {headline.headline}
        </span>
      </div>
      {headline.detail && (
        <p className="text-sm text-text-muted leading-relaxed">
          {headline.detail}
        </p>
      )}
    </div>
  );
}

// ── Full briefing (expandable via native <details>) ────────────

function FullBriefing({ report }: { report: ConcentrationReport }) {
  const { positions, factors, scenarios, move } = report;
  return (
    <details className="relative flex flex-col">
      <summary className="cursor-pointer flex items-center justify-between gap-3 pt-5 mt-1.5 border-t border-white/[0.06] list-none [&::-webkit-details-marker]:hidden hover:opacity-75 transition-opacity">
        <div className="flex flex-col gap-1">
          <span className="font-plex text-[11px] uppercase tracking-[0.18em] font-semibold text-text-secondary">
            Full briefing
          </span>
          <span className="font-plex text-[10px] uppercase tracking-[0.14em] text-text-muted">
            Weight · correlation · stress · the move
          </span>
        </div>
        <span className="insights-caret font-plex text-lg text-text-muted leading-none">
          ↓
        </span>
      </summary>

      <div className="flex flex-col gap-5 mt-5">
        <PositionWeights positions={positions} />
        <FactorBars factors={factors} positions={positions} />
        {scenarios.length > 0 && <StressMatrix scenarios={scenarios} />}
        {move && <MoveBlock move={move} />}
      </div>
    </details>
  );
}

// ── Chapter header (top rule + label + optional aside) ─────────

function ChapterHead({
  label,
  aside,
  danger,
}: {
  label: string;
  aside?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline pt-5 border-t border-white/[0.06]">
      <span
        className={`font-plex text-[11px] uppercase tracking-[0.18em] font-semibold ${
          danger ? "text-[#FF5000]" : "text-text-muted"
        }`}
      >
        {label}
      </span>
      {aside && (
        <span className="font-plex text-[10px] uppercase tracking-[0.14em] text-text-muted">
          {aside}
        </span>
      )}
    </div>
  );
}

function Connector({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-text-secondary leading-relaxed">
      {children}
    </p>
  );
}

// ── Position weights — treemap ─────────────────────────────────

function PositionWeights({ positions }: { positions: Position[] }) {
  const top1 = positions[0];
  if (!top1) return null;
  const rest = positions.slice(1, 4);
  const top3 = positions.slice(0, 3);
  const top3Pct = top3.reduce((s, p) => s + p.pct, 0);
  const remaining = positions.length > 4 ? positions.slice(4) : [];
  const remainingPct = remaining.reduce((s, p) => s + p.pct, 0);

  // Proportional flex weights for the right column so cell heights track each
  // holding's share of the rest group. Flexbox is more reliable than CSS grid
  // here — grid's row sizing without explicit grid-template-rows can leave
  // cells un-stretched, which let the Tesla cell visually overflow.
  const restTotal = rest.reduce((s, p) => s + p.pct, 0);
  const flexes = rest.map((p) =>
    restTotal > 0 ? Math.max(0.5, p.pct / restTotal) : 1,
  );

  return (
    <div className="flex flex-col gap-3">
      <ChapterHead
        label="Where the weight sits"
        aside={`Top 3 = ${pct(top3Pct)}`}
      />
      <div
        className="flex gap-1 overflow-hidden"
        style={{ height: 240 }}
      >
        <div className="flex-[5] min-h-0 min-w-0">
          <TmCell position={top1} large />
        </div>
        {rest.length > 0 && (
          <div className="flex-[3] min-h-0 min-w-0 flex flex-col gap-1">
            {rest.map((p, i) => (
              <div
                key={p.name}
                className="min-h-0"
                style={{ flex: `${flexes[i]} ${flexes[i]} 0%` }}
              >
                <TmCell position={p} />
              </div>
            ))}
          </div>
        )}
      </div>
      {remaining.length > 0 && (
        <div className="flex justify-between items-baseline text-xs text-text-muted pt-1">
          <span>
            + {remaining.length} smaller position
            {remaining.length === 1 ? "" : "s"}, {pct(remainingPct)} combined
          </span>
        </div>
      )}
      <Connector>
        Three positions —{" "}
        <strong className="text-foreground font-medium">{top3[0]?.name}</strong>
        {top3[1] && (
          <>
            ,{" "}
            <strong className="text-foreground font-medium">
              {top3[1].name}
            </strong>
          </>
        )}
        {top3[2] && (
          <>
            , and{" "}
            <strong className="text-foreground font-medium">
              {top3[2].name}
            </strong>
          </>
        )}{" "}
        — carry {pct(top3Pct)} of your wealth.
      </Connector>
    </div>
  );
}

function TmCell({
  position,
  large,
}: {
  position: Position;
  large?: boolean;
}) {
  const tint =
    position.assetClass === "equity"
      ? "bg-[#FF5000]/[0.14] border-[#FF5000]/[0.28]"
      : position.assetClass === "crypto"
        ? "bg-[#F5C518]/[0.14] border-[#F5C518]/[0.28]"
        : position.assetClass === "etf"
          ? "bg-[#FF5000]/[0.07] border-[#FF5000]/[0.18]"
          : "bg-[#7FFFD4]/[0.10] border-[#7FFFD4]/[0.22]";
  const pctColor =
    position.assetClass === "equity"
      ? "text-[#FF5000]"
      : position.assetClass === "crypto"
        ? "text-gold"
        : position.assetClass === "etf"
          ? "text-[#FF8855]"
          : "text-[#7FFFD4]";
  return (
    <div
      className={`relative h-full p-4 rounded-lg border flex flex-col justify-between overflow-hidden ${tint}`}
    >
      <div className="min-w-0">
        <div
          className={`text-foreground font-medium truncate ${large ? "text-base" : "text-sm"}`}
        >
          {position.name}
        </div>
        {position.symbol && (
          <div className="font-plex text-[10px] uppercase tracking-[0.08em] text-text-muted mt-0.5 truncate">
            {position.assetClass} · {position.symbol}
          </div>
        )}
      </div>
      <div
        className={`font-display tabular-nums font-bold tracking-[-0.03em] leading-none ${pctColor}`}
        style={{ fontSize: large ? 56 : 20 }}
      >
        {pct(position.pct)}
      </div>
    </div>
  );
}

// ── Factor exposure — horizontal bars ──────────────────────────

function FactorBars({
  factors,
  positions,
}: {
  factors: FactorExposure[];
  positions: Position[];
}) {
  const usGrowth = factors.find((f) => f.factor === "us_growth_tech")?.pct ?? 0;
  const aiSemis = factors.find((f) => f.factor === "ai_semis")?.pct ?? 0;
  const crypto = factors.find((f) => f.factor === "crypto")?.pct ?? 0;
  const china = factors.find((f) => f.factor === "china_tech")?.pct ?? 0;
  const stable = factors.find((f) => f.factor === "stablecoin")?.pct ?? 0;
  const cashClass = positions
    .filter((p) => p.assetClass === "cash")
    .reduce((s, p) => s + p.pct, 0);

  // Unique risk-on share: us_growth_tech (which already includes ai_semis) ∪
  // crypto. Two disjoint sets — no double-count.
  const riskOn = usGrowth + crypto;

  type Row = {
    name: string;
    value: number;
    minShow: number;
    bg: string; // inline CSS background
    muted?: boolean;
  };
  const candidates: Row[] = [
    {
      name: "Risk-on tech & liquidity",
      value: riskOn,
      minShow: 0.3,
      bg: "linear-gradient(90deg, #FF5000, #ff8855)",
    },
    {
      name: "└ US growth tech",
      value: usGrowth,
      minShow: 0.05,
      bg: "linear-gradient(90deg, #FF5000, #ff8855)",
    },
    {
      name: "└ AI & semiconductors",
      value: aiSemis,
      minShow: 0.05,
      bg: "linear-gradient(90deg, #FF5000, #F5C518)",
    },
    {
      name: "└ Crypto (volatile)",
      value: crypto,
      minShow: 0.05,
      bg: "#F5C518",
    },
    {
      name: "China tech",
      value: china,
      minShow: 0.1,
      bg: "linear-gradient(90deg, #555, #777)",
      muted: true,
    },
    {
      name: "Stablecoins (cash-like)",
      value: stable,
      minShow: 0.05,
      bg: "rgba(127,255,212,0.5)",
      muted: true,
    },
    {
      name: "Cash",
      value: cashClass,
      minShow: 0.02,
      bg: "#7FFFD4",
      muted: cashClass < 0.05,
    },
  ];
  const rows = candidates.filter((r) => r.value >= r.minShow);

  const topNames = positions.slice(0, 3).map((p) => p.name);

  return (
    <div className="flex flex-col gap-3">
      <ChapterHead label="Why they move together" aside="Factor exposure" />
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.name} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-baseline text-[13px]">
              <span className={r.muted ? "text-text-muted" : "text-text-secondary"}>
                {r.name}
              </span>
              <span className="font-display tabular-nums text-foreground font-medium">
                {pct(r.value)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, r.value * 100)}%`,
                  background: r.bg,
                  opacity: r.name === "└ US growth tech" ? 0.75 : 1,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {topNames.length >= 2 && (
        <Connector>
          <strong className="text-foreground font-medium">{topNames[0]}</strong>
          {topNames[1] && (
            <>
              ,{" "}
              <strong className="text-foreground font-medium">
                {topNames[1]}
              </strong>
            </>
          )}
          {topNames[2] && (
            <>
              , and{" "}
              <strong className="text-foreground font-medium">
                {topNames[2]}
              </strong>
            </>
          )}{" "}
          all load on the same risk-on liquidity factor. Splitting
          &ldquo;stocks&rdquo; from &ldquo;crypto&rdquo; hides that they&apos;re{" "}
          <strong className="text-foreground font-medium">
            the same trade
          </strong>{" "}
          in different containers.
        </Connector>
      )}
    </div>
  );
}

// ── Stress matrix — multi-shock ───────────────────────────────

function StressMatrix({ scenarios }: { scenarios: Scenario[] }) {
  const worst = scenarios.reduce((a, b) =>
    a.impactPct > b.impactPct ? a : b,
  );
  return (
    <div className="flex flex-col gap-3">
      <ChapterHead label="If it cracks" aside="Impact on NAV" danger />
      <div className="flex flex-col gap-2.5">
        {scenarios.map((s) => {
          const isWorst = s === worst;
          return (
            <div
              key={s.label}
              className="grid items-center gap-3 text-[13px]"
              style={{ gridTemplateColumns: "1fr 90px 70px" }}
            >
              <span
                className={
                  isWorst
                    ? "text-foreground font-medium"
                    : "text-text-secondary"
                }
              >
                {s.label}
              </span>
              <span className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <span
                  className="block h-full rounded-full bg-[#FF5000]"
                  style={{
                    width: `${Math.min(100, s.positionPct * 100)}%`,
                    boxShadow: isWorst
                      ? "0 0 8px rgba(255,80,0,0.5)"
                      : "none",
                  }}
                />
              </span>
              <span className="font-display tabular-nums text-[#FF5000] font-semibold text-right">
                −{pct(s.impactPct)}
              </span>
            </div>
          );
        })}
      </div>
      <Connector>
        The single-name shock is bounded by the top position&apos;s weight. The
        correlated shock hits the whole risk-on cluster at once — that&apos;s
        the asymmetry a position view hides.
      </Connector>
    </div>
  );
}

// ── The move — gold callout (the answer, not a question) ──────

function MoveBlock({ move }: { move: Move }) {
  return (
    <div className="flex flex-col gap-2.5 p-4 mt-1.5 rounded-xl bg-[#F5C518]/[0.06] border border-[#F5C518]/[0.30]">
      <div className="flex justify-between items-baseline">
        <span className="font-plex text-[10px] uppercase tracking-[0.18em] font-semibold text-gold">
          The move
        </span>
        <span className="font-plex text-[10px] uppercase tracking-[0.14em] text-text-muted">
          90-day plan
        </span>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed">
        {renderMoveText(move.text)}
      </p>
      <p className="text-xs text-text-muted leading-relaxed">{move.coda}</p>
    </div>
  );
}

/**
 * Render the move's `text` with **double-asterisk** runs as <strong>. Splits
 * into alternating literal / bold segments.
 */
function renderMoveText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-foreground font-medium">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
