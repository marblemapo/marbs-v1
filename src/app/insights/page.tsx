import { redirect } from "next/navigation";
import { getSessionUser, getProfile, displayNameFor } from "@/lib/session";
import { SidebarRail } from "@/components/clarity/sidebar-rail";
import { ConcentrationPanel } from "@/components/concentration-panel";
import { getHoldingsReport } from "@/lib/holdings-report";

// Insights surface — houses the concentration/behavioral read that used to sit
// on the Overview. Removal from Overview was a deliberate call in the Clarity
// handoff (README §106); the sidebar rail promotes Insights to a first-class
// page instead.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function InsightsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Profile is memoised per request and shared with getHoldingsReport().
  const [profile, report] = await Promise.all([
    getProfile(user.id),
    getHoldingsReport(),
  ]);
  if (!report) redirect("/login");
  const displayName = displayNameFor(user, profile);

  return (
    <div className="clarity-shell flex-1 flex font-sans text-white">
      <SidebarRail active="insights" displayName={displayName} />
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-[26px] pb-6">
        <div className="mx-auto max-w-[1000px]">
          <header className="mb-8">
            <div className="hidden md:block text-[13px] text-[#7d8085]">Portfolio</div>
            <div className="font-display font-bold text-[22px] md:text-[22px] text-white">
              Insights
            </div>
          </header>
          <ConcentrationPanel report={report.concentration} />
        </div>
      </main>
    </div>
  );
}
