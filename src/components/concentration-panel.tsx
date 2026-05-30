import type { ConcentrationReport, Severity } from "@/lib/insights";

const dotClass: Record<Severity, string> = {
  high: "bg-[#FF5000]",
  elevated: "bg-gold",
  info: "bg-[#7FFFD4]",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Presentational read of a ConcentrationReport. Visual hierarchy:
 *   stat (font-display, large)    — "82%" lifted as the typographic hero
 *   caption (text-secondary)      — short phrase that completes the sentence
 *   detail (text-muted, small)    — one-line context
 * Secondaries collapse to a single line each (dot · stat · caption, no prose).
 * Shared by the dashboard and (eventually) the public Portfolio X-Ray.
 */
export function ConcentrationPanel({ report }: { report: ConcentrationReport }) {
  const { headline, findings, scenario } = report;
  const rest = headline ? findings.slice(1) : findings;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-plex text-[11px] text-text-muted uppercase tracking-[0.14em] font-medium">
        Insights
      </h2>

      {headline ? (
        <div className="flex flex-col gap-6 p-7 rounded-2xl bg-[#0A0A0A] border border-white/[0.08]">
          {/* Lead — stat lifted as the typographic hero */}
          <div className="flex flex-col gap-2">
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

          {/* Stress test */}
          {scenario && (
            <div className="flex flex-col gap-1 p-4 rounded-xl bg-[#FF5000]/[0.06] border border-[#FF5000]/20">
              <span className="font-plex text-[10px] uppercase tracking-[0.16em] text-[#FF5000] font-semibold">
                Stress test
              </span>
              <span className="text-sm text-text-secondary leading-relaxed">
                If{" "}
                <span className="text-foreground font-medium">
                  {scenario.positionName}
                </span>{" "}
                fell {pct(scenario.dropPct)}, your net worth would drop{" "}
                <span className="text-foreground font-semibold">
                  {pct(scenario.netWorthImpactPct)}
                </span>{" "}
                — in a single day.
              </span>
            </div>
          )}

          {/* Secondary findings — one-liners, no detail prose */}
          {rest.length > 0 && (
            <ul className="flex flex-col gap-2.5 pt-4 border-t border-white/[0.06]">
              {rest.map((f, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass[f.severity]}`}
                  />
                  <div className="text-sm flex items-baseline gap-1.5 flex-wrap">
                    {f.stat && (
                      <span className="font-display font-medium tabular-nums text-foreground">
                        {f.stat}
                      </span>
                    )}
                    <span className="text-text-secondary">{f.headline}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="p-7 rounded-2xl bg-[#0A0A0A] border border-white/[0.08]">
          <div className="text-sm text-text-secondary leading-relaxed">
            No single name or class dominates. The moment that changes,
            you&apos;ll see it here.
          </div>
        </div>
      )}
    </section>
  );
}
