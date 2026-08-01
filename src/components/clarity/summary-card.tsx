import type { HoldingsRow } from "@/lib/holdings-report";

// Placeholder for the design's Invested / All-time-gain card. Cost basis
// needs the transactions table wired per-user, which isn't done yet — so
// for v0 we surface two facts we DO have: total priced positions and the
// top holding's weight. Follow-up: swap for real invested + gain once
// cost-basis is populated.

export function SummaryCard({
  rows,
  netWorth,
}: {
  rows: HoldingsRow[];
  netWorth: number;
}) {
  const priced = rows.filter((r) => r.value_native != null);
  const top = priced[0];
  const topPct =
    top && netWorth > 0 && top.value_native != null
      ? Math.round((top.value_native / netWorth) * 100)
      : null;
  const topLabel = top
    ? `${top.symbol ?? top.name}${topPct != null ? ` · ${topPct}%` : ""}`
    : "—";

  return (
    <section className="clarity-card p-[22px] flex-1 flex flex-col justify-center gap-[18px]">
      <div>
        <div className="text-[12px] text-[#7d8085] mb-1.5">Positions</div>
        <div className="font-display font-bold text-[22px] text-white tabular-nums">
          {priced.length}
        </div>
      </div>
      <div className="h-px bg-white/[0.06]" />
      <div className="min-w-0">
        <div className="text-[12px] text-[#7d8085] mb-1.5">Top position</div>
        <div className="font-display font-bold text-[22px] text-white tabular-nums truncate">
          {topLabel}
        </div>
      </div>
    </section>
  );
}
