import type { Holding } from "@/lib/insights";

// Allocation glass card (spec 2a right column) — segmented bar + labelled
// legend. Colors match the design's asset-class palette: mint crypto,
// blue equity, gold cash, purple ETFs. Rows below 1% are hidden so the bar
// doesn't render invisible slivers.

const CLASS_META: Record<
  string,
  { swatch: string; label: string }
> = {
  crypto: { swatch: "#00E5A0", label: "Crypto" },
  equity: { swatch: "#3aa0ff", label: "Stocks" },
  etf: { swatch: "#b07cff", label: "ETFs" },
  cash: { swatch: "#f5c518", label: "Cash" },
};

const CLASS_ORDER = ["crypto", "equity", "etf", "cash"] as const;

export function AllocationCard({ holdings }: { holdings: Holding[] }) {
  const total = holdings.reduce((s, h) => s + h.valueBase, 0);

  const perClass = new Map<string, number>();
  for (const h of holdings) {
    perClass.set(h.assetClass, (perClass.get(h.assetClass) ?? 0) + h.valueBase);
  }

  const rows = CLASS_ORDER.map((cls) => {
    const value = perClass.get(cls) ?? 0;
    const pct = total > 0 ? (value / total) * 100 : 0;
    return { key: cls, ...CLASS_META[cls], value, pct };
  }).filter((r) => r.pct >= 1);

  return (
    <section className="clarity-card p-[22px]">
      <div className="text-[13px] text-[#7d8085] mb-4">Allocation</div>
      {rows.length > 0 ? (
        <>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-4">
            {rows.map((r) => (
              <div
                key={r.key}
                style={{ flex: r.pct, background: r.swatch }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-[11px]">
            {rows.map((r) => (
              <div
                key={r.key}
                className="flex items-center justify-between text-[13px]"
              >
                <span className="text-[#c3c5c9]">
                  <span style={{ color: r.swatch }}>●</span> {r.label}
                </span>
                <span className="font-display font-bold text-white tabular-nums">
                  {Math.round(r.pct)}%
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-sm text-[#7d8085]">
          Add assets to see allocation.
        </div>
      )}
    </section>
  );
}
