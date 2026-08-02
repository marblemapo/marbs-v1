"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddAssetDrawer } from "@/components/add-asset-drawer";

const TABS = [
  { key: "home", label: "Home", icon: "⊞", href: "/dashboard" },
  { key: "assets", label: "Assets", icon: "☰", href: "/holdings" },
  { key: "fab", label: "", icon: "+", href: "" },
  { key: "insights", label: "Insights", icon: "◔", href: "/insights" },
  { key: "you", label: "You", icon: "⊙", href: "/settings" },
] as const;

const ACTIVE_MAP: Record<string, string> = {
  "/dashboard": "home",
  "/holdings": "assets",
  "/insights": "insights",
  "/settings": "you",
};

export function MobileTabBar({ baseCurrency }: { baseCurrency: string }) {
  const pathname = usePathname();
  const activeKey = ACTIVE_MAP[pathname] ?? "home";

  return (
    <nav className="clarity-tab-bar md:hidden">
      {TABS.map((tab) => {
        if (tab.key === "fab") {
          return (
            <AddAssetDrawer
              key="fab"
              baseCurrency={baseCurrency}
              fabMode
            />
          );
        }
        const isActive = tab.key === activeKey;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="flex flex-col items-center gap-1"
          >
            <span
              className="text-[19px]"
              style={{ color: isActive ? "#00E5A0" : "#6f7a74" }}
            >
              {tab.icon}
            </span>
            <span
              className="font-mono text-[9px]"
              style={{ color: isActive ? "#00E5A0" : "#6f7a74" }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
