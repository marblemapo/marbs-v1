import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarRail } from "@/components/clarity/sidebar-rail";
import { OverviewTopbar } from "@/components/clarity/overview-topbar";
import { HoldingsTable } from "@/components/clarity/holdings-table";
import { CurrencyProvider } from "@/components/currency-context";
import { getHoldingsReport } from "@/lib/holdings-report";

// Holdings surface — the sidebar rail's Holdings tab. Focused view of the
// same table Overview shows at the bottom, but here it's the main content
// (no hero, no allocation), giving the position list room to breathe.
//
// The 2b design HTML is actually the "Add asset" full-page flow, not a
// list view — that redesign is deferred. AddAssetDrawer (opened from the
// topbar "+ Add asset" button) remains the entry point for now.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function HoldingsPage() {
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

  const { baseCurrency, currencies, fxRates, rowsWithValue } = report;

  return (
    <div className="clarity-shell flex-1 flex font-sans text-white">
      <SidebarRail active="holdings" displayName={displayName} />
      <main className="flex-1 min-w-0 overflow-y-auto px-6 py-6 lg:px-8 lg:py-[26px]">
        <div className="mx-auto max-w-[1240px]">
          <OverviewTopbar
            displayName={displayName}
            title="Holdings"
            baseCurrency={baseCurrency}
          />
          <CurrencyProvider
            baseCurrency={baseCurrency}
            currencies={currencies}
            fxRates={fxRates}
          >
            <HoldingsTable rows={rowsWithValue} />
          </CurrencyProvider>
        </div>
      </main>
    </div>
  );
}
