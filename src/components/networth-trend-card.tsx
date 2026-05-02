import { getNetWorthHistory } from "@/app/actions/net-worth-history";
import { NetWorthTrendCalculating } from "./networth-trend-calculating";
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
  // Show a client-side auto-refreshing spinner so the chart just appears
  // without the user having to manually reload.
  const hasOnlyNoData = Object.values(data.series).every(
    (s) => !s.available && s.reason === "no_data",
  );
  if (!hasAny && hasOnlyNoData) return <NetWorthTrendCalculating />;

  return (
    <NetWorthTrendChart
      series={data.series}
      baseCurrency={data.base_currency}
      onboardingDate={data.onboarding_date}
      hasManualPricedAssets={data.has_manual_priced_assets}
    />
  );
}
