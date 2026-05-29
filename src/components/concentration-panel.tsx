import type { ConcentrationReport, Severity } from "@/lib/insights";

const dotClass: Record<Severity, string> = {
  high: "bg-[#FF5000]",
  elevated: "bg-gold",
  info: "bg-[#7FFFD4]",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Presentational read of a ConcentrationReport. Pure percentages/counts, so it
 * renders identically regardless of the user's display currency. Shared by the
 * dashboard and the public Portfolio X-Ray.
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
        <div className="flex flex-col gap-5 p-7 rounded-2xl bg-[#0A0A0A] border border-white/[0.08]">
          {/* Lead finding */}
          <div className="flex items-start gap-3">
            <span
              className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${dotClass[headline.severity]}`}
            />
            <div className="flex flex-col gap-1.5">
              <div className="font-display text-base font-medium leading-snug tracking-[-0.02em]">
                {headline.headline}
              </div>
              <div className="text-sm text-text-secondary leading-relaxed">
                {headline.detail}
              </div>
            </div>
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

          {/* Secondary findings */}
          {rest.length > 0 && (
            <div className="flex flex-col gap-2.5 pt-4 border-t border-white/[0.06]">
              {rest.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${dotClass[f.severity]}`}
                  />
                  <span className="text-sm text-text-secondary leading-relaxed">
                    <span className="text-foreground font-medium">
                      {f.headline}
                    </span>{" "}
                    {f.detail}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-7 rounded-2xl bg-[#0A0A0A] border border-white/[0.08]">
          <div className="text-sm text-text-secondary leading-relaxed">
            Your portfolio looks broadly balanced — no single name or asset
            class dominates. The moment that changes, you&apos;ll see it here.
          </div>
        </div>
      )}
    </section>
  );
}
