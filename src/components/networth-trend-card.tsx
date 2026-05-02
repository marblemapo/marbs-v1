import { getNetWorthHistory } from "@/app/actions/net-worth-history";
import { NetWorthTrendChart } from "./networth-trend-chart";

/**
 * Server wrapper for the trend chart. Fetches history via the server action
 * and hands the full series payload to the client chart, which slices ranges
 * locally on tab switch (no extra round-trips).
 */
export async function NetWorthTrendCard() {
  const data = await getNetWorthHistory();

  // Hide the card entirely if there's no data at all (empty portfolio,
  // pre-backfill). The card has no value yet — the hero already shows the
  // empty state.
  const hasAny = Object.values(data.series).some(
    (s) => s.available && s.points.length > 0,
  );
  if (!hasAny) return null;

  return (
    <NetWorthTrendChart
      series={data.series}
      baseCurrency={data.base_currency}
      onboardingDate={data.onboarding_date}
      hasManualPricedAssets={data.has_manual_priced_assets}
    />
  );
}
