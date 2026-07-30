import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshMissingLogos } from "@/app/actions/assets";
import { SidebarRail } from "@/components/clarity/sidebar-rail";
import { OverviewTopbar } from "@/components/clarity/overview-topbar";
import { NetWorthCard } from "@/components/clarity/net-worth-card";
import { NetWorthTrendCard } from "@/components/networth-trend-card";
import { AllocationCard } from "@/components/clarity/allocation-card";
import { SummaryCard } from "@/components/clarity/summary-card";
import { HoldingsTable } from "@/components/clarity/holdings-table";
import { CurrencyProvider } from "@/components/currency-context";
import { getHoldingsReport } from "@/lib/holdings-report";
import { backfillUserHistory, recomputeBackfillRange } from "@/lib/net-worth";

// Overview surface (Clarity spec 2a): sidebar rail on the left, topbar with
// greeting + search + Add asset, two-column hero (net-worth + trend on the
// left, allocation + summary on the right), holdings table below.
//
// Data fetch is delegated to getHoldingsReport() so /dashboard and /insights
// stay in lock-step. Backfill triggers (logos + history) stay at this level
// as post-response after() callbacks — they aren't part of the report.
//
// The concentration panel, connected-wallets section, and danger zone moved
// to /insights and /settings per the handoff. Holdings 2b / Activity are
// stub routes for the sidebar to point at (not built yet).

export const dynamic = "force-dynamic";
// Extend function lifetime so after() callbacks (logo + history backfill)
// finish on Vercel Hobby, where the default is 10s. Hobby caps at 60s.
export const maxDuration = 60;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "You";

  const report = await getHoldingsReport();
  if (!report) redirect("/login");

  // --- Post-response backfill triggers (unchanged from prior dashboard) ---
  const { data: assetsForChecks } = await supabase
    .from("assets")
    .select("id, external_id, price_source, asset_class, symbol, metadata");

  const missingLogo = (assetsForChecks ?? []).some((a) => {
    if (a.asset_class !== "equity" && a.asset_class !== "etf") return false;
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    return !meta.logo || typeof meta.logo !== "string";
  });
  if (missingLogo) {
    after(async () => {
      const res = await refreshMissingLogos();
      if (res.ok && res.updated > 0) {
        console.log(`[dashboard] backfilled ${res.updated} asset logo(s)`);
      }
    });
  }

  if ((assetsForChecks ?? []).length > 0) {
    const pricedAssets = (assetsForChecks ?? []).filter(
      (a) =>
        a.external_id &&
        a.price_source !== "manual" &&
        a.asset_class !== "cash",
    );
    const historyChecks = await Promise.all(
      pricedAssets.map(async (a) => {
        const { count } = await supabase
          .from("price_history")
          .select("*", { count: "exact", head: true })
          .eq("external_id", a.external_id!)
          .eq("source", a.price_source);
        const symbol = (a.symbol ?? "").toUpperCase();
        const needsStockRetry =
          (a.asset_class === "equity" || a.asset_class === "etf") &&
          (count ?? 0) < 1000;
        const needsMajorCryptoRetry =
          a.asset_class === "crypto" &&
          ["BTC", "BTC-USD", "BNB", "BNB-USD", "ETH", "ETH-USD"].includes(
            symbol,
          ) &&
          (count ?? 0) < 1000;
        return (count ?? 0) === 0 || needsStockRetry || needsMajorCryptoRetry;
      }),
    );
    const hasSparsePriceHistory = historyChecks.some(Boolean);

    const { count: backfilledCount } = await supabase
      .from("net_worth_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_backfilled", true);
    if ((backfilledCount ?? 0) < 30 || hasSparsePriceHistory) {
      after(() => backfillUserHistory(user.id));
    } else {
      const { data: recentSnaps } = await supabase
        .from("net_worth_snapshots")
        .select("total_usd, coverage_pct, breakdown_usd")
        .eq("user_id", user.id)
        .eq("is_backfilled", true)
        .order("snapshot_date", { ascending: false })
        .limit(10);
      const isOldQualityModel =
        (recentSnaps ?? []).length >= 5 &&
        (recentSnaps ?? []).every((s) => {
          const breakdown = s.breakdown_usd;
          return !(
            breakdown &&
            typeof breakdown === "object" &&
            "_meta" in breakdown
          );
        });
      const isBadBackfill =
        (recentSnaps ?? []).length >= 5 &&
        (recentSnaps ?? []).every(
          (s) => Number(s.total_usd) <= 0 || Number(s.coverage_pct) <= 0,
        );
      const hasLowCoverageBackfill =
        (recentSnaps ?? []).length >= 5 &&
        (recentSnaps ?? []).every((s) => Number(s.coverage_pct) < 0.7);
      if (isOldQualityModel) after(() => recomputeBackfillRange(user.id));
      else if (isBadBackfill) after(() => recomputeBackfillRange(user.id));
      else if (hasLowCoverageBackfill)
        after(() => recomputeBackfillRange(user.id));
    }
  }

  const { baseCurrency, currencies, fxRates, rowsWithValue, holdings, concentration } =
    report;

  const rowsForHero = rowsWithValue.map((r) => ({
    native_currency: r.native_currency,
    value_native: r.value_native,
    previous_value_native: r.previous_value_native,
  }));

  return (
    <div className="clarity-shell flex-1 flex font-sans text-white">
      <SidebarRail active="overview" displayName={displayName} />
      <main className="flex-1 min-w-0 overflow-y-auto px-6 py-6 lg:px-8 lg:py-[26px]">
        <div className="mx-auto max-w-[1240px]">
          <OverviewTopbar
            displayName={displayName}
            title="Overview"
            baseCurrency={baseCurrency}
          />
          <CurrencyProvider
            baseCurrency={baseCurrency}
            currencies={currencies}
            fxRates={fxRates}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 mb-5">
              {/* Left column: net worth + trend */}
              <div className="flex flex-col gap-5 min-w-0">
                <NetWorthCard rows={rowsForHero} />
                <NetWorthTrendCard />
              </div>
              {/* Right column: allocation + summary */}
              <div className="flex flex-col gap-5">
                <AllocationCard holdings={holdings} />
                <SummaryCard
                  rows={rowsWithValue}
                  netWorth={concentration.netWorth}
                />
              </div>
            </div>
            <HoldingsTable rows={rowsWithValue} />
          </CurrencyProvider>
        </div>
      </main>
    </div>
  );
}
