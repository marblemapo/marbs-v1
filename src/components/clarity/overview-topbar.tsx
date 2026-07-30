import { AddAssetDrawer } from "@/components/add-asset-drawer";
import { AssetSearch } from "@/components/clarity/asset-search";

// Overview topbar (spec 2a): left-aligned greeting + page title, right-aligned
// search field + primary "+ Add asset" pill. Greeting stays plain ("Hello,")
// so we don't have to guess the user's timezone from the server for a
// morning/evening variant.

export function OverviewTopbar({
  displayName,
  title,
  baseCurrency,
}: {
  displayName: string;
  title: string;
  baseCurrency: string;
}) {
  return (
    <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
      <div>
        <div className="text-[13px] text-[#7d8085]">Hello, {displayName}</div>
        <div className="font-display font-bold text-[22px] text-white">
          {title}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <AssetSearch />
        <AddAssetDrawer baseCurrency={baseCurrency} />
      </div>
    </div>
  );
}
