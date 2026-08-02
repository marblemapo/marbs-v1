import Link from "next/link";

// Collapsible sidebar rail for the Clarity authed shell (spec 2a). 78px
// collapsed, expands to 236px on hover; labels fade in only while hovered.
// Pure CSS-driven — no React state, so this stays a server component and
// costs zero client JS across every authed route that mounts it.

export type RailItem =
  | "overview"
  | "holdings"
  | "insights"
  | "activity"
  | "settings";

type NavEntry = {
  key: RailItem;
  label: string;
  icon: string;
  href: string;
};

const NAV: NavEntry[] = [
  { key: "overview", label: "Overview", icon: "⊞", href: "/dashboard" },
  { key: "holdings", label: "Holdings", icon: "☰", href: "/holdings" },
  { key: "insights", label: "Insights", icon: "◔", href: "/insights" },
  { key: "activity", label: "Activity", icon: "↗", href: "/activity" },
  { key: "settings", label: "Settings", icon: "⊙", href: "/settings" },
];

export function SidebarRail({
  active,
  displayName,
}: {
  active: RailItem;
  displayName: string;
}) {
  const initial = (displayName || "?").slice(0, 1).toUpperCase();

  return (
    <aside className="clarity-rail flex-shrink-0 overflow-hidden hidden md:flex flex-col py-[22px] px-[15px] whitespace-nowrap">
      {/* Wordmark */}
      <div className="flex items-center gap-[14px] pl-0.5 pb-[30px]">
        <div
          className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-display font-bold text-[#052018]"
          style={{
            background: "linear-gradient(135deg, #00E5A0, #00a877)",
            boxShadow: "0 10px 22px -6px rgba(0,229,160,0.55)",
          }}
        >
          W
        </div>
        <span className="clarity-rail-label font-display font-bold text-lg text-white">
          Wealth
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-[5px]">
        {NAV.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-4 p-3 rounded-[14px] transition-colors ${
                isActive
                  ? "text-white"
                  : "text-[#8a8d92] hover:text-white hover:bg-white/[0.04]"
              }`}
              style={
                isActive
                  ? {
                      background:
                        "linear-gradient(135deg, rgba(0,229,160,0.22), rgba(0,229,160,0.05))",
                      boxShadow: "inset 0 0 0 1px rgba(0,229,160,0.28)",
                    }
                  : undefined
              }
            >
              <span
                className={`w-[22px] shrink-0 text-center text-[17px] ${
                  isActive ? "text-[#00E5A0]" : "text-[#6f7a74]"
                }`}
              >
                {item.icon}
              </span>
              <span className="clarity-rail-label text-sm font-semibold">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer: Live prices indicator + account pill */}
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center gap-4 py-[11px] px-3 rounded-xl bg-[#00E5A0]/[0.08]">
          <span className="w-[22px] shrink-0 flex justify-center">
            <span className="w-2 h-2 rounded-full bg-[#00E5A0] clarity-pulseg" />
          </span>
          <span className="clarity-rail-label font-mono text-[11px] text-[#00E5A0]">
            Live prices
          </span>
        </div>
        <div className="flex items-center gap-4 px-1.5 py-1">
          <span className="w-[38px] h-[38px] shrink-0 rounded-full bg-[#232f29] text-white flex items-center justify-center font-display font-bold text-sm">
            {initial}
          </span>
          <span className="clarity-rail-label">
            <span className="block text-[13px] font-semibold text-white">
              {displayName}
            </span>
            <span className="block text-[11px] text-[#7d8085]">
              Private · no bank link
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}
