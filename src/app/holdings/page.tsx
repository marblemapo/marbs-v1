import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarRail } from "@/components/clarity/sidebar-rail";
import { HoldingsTable } from "@/components/clarity/holdings-table";
import { CurrencyProvider } from "@/components/currency-context";
import { getHoldingsReport } from "@/lib/holdings-report";
import { AddAssetDrawer } from "@/components/add-asset-drawer";

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
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-[26px] pb-6">
        <div className="mx-auto max-w-[1240px]">
          {/* Mobile header */}
          <div className="flex md:hidden items-center justify-between mb-5">
            <span className="font-display font-bold text-[24px] text-white">Holdings</span>
            <AddAssetDrawer baseCurrency={baseCurrency} />
          </div>
          {/* Desktop topbar */}
          <div className="hidden md:flex items-center justify-between mb-8 gap-4">
            <div>
              <div className="text-[13px] text-[#7d8085]">Hello, {displayName}</div>
              <div className="font-display font-bold text-[22px] text-white">Holdings</div>
            </div>
            <AddAssetDrawer baseCurrency={baseCurrency} />
          </div>
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
