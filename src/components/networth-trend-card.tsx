import { getNetWorthHistory } from "@/app/actions/net-worth-history";
import { NetWorthTrendChart } from "./networth-trend-chart";

/**
 * Server wrapper for the trend chart. Fetches history via the server action
 * and hands the full series payload to the client chart, which slices ranges
 * locally on tab switch (no extra round-trips).
 */
export async function NetWorthTrendCard() {
  const data = await getNetWorthHistory();

  // No portfolio at all — hero already shows the empty state; skip the card.
  if (data.no_assets) return null;

  const hasAny = Object.values(data.series).some(
    (s) => s.available && s.points.length > 0,
  );

  // Backfill hasn't produced rows yet (first load, or still in progress).
  // Show a quiet placeholder so the user knows the feature exists.
  if (!hasAny) {
    return (
      <section className="flex flex-col gap-4 p-7 rounded-2xl bg-[#0A0A0A] border border-white/[0.08]">
        <div className="flex items-center gap-2">
          <span className="font-plex text-[11px] text-text-muted uppercase tracking-[0.18em] font-medium">
            Trend
          </span>
        </div>
        <div className="h-[200px] flex flex-col items-center justify-center gap-2">
          <div className="w-5 h-5 rounded-full border-2 border-[#7FFFD4]/40 border-t-[#7FFFD4] animate-spin" />
          <p className="font-plex text-[12px] text-text-muted text-center">
            Calculating your net worth history…
          </p>
          <p className="font-plex text-[11px] text-text-muted/60 text-center">
            Refresh in a moment once the first load completes.
          </p>
        </div>
      </section>
    );
  }

  return (
    <NetWorthTrendChart
      series={data.series}
      baseCurrency={data.base_currency}
      onboardingDate={data.onboarding_date}
      hasManualPricedAssets={data.has_manual_priced_assets}
    />
  );
}
