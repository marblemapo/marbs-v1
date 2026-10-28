import { SidebarRail, type RailItem } from "@/components/clarity/sidebar-rail";

// Instant loading state for the authed Clarity pages, rendered by each
// route's loading.tsx.
//
// Why it matters: these pages are fully dynamic, and Next.js only prefetches
// a dynamic route down to its nearest loading.tsx. With no loading.tsx,
// clicking "Enter vault" or a sidebar link prefetched nothing and the screen
// sat frozen until the whole server render finished. With it, the shell is
// prefetched and swaps in on click; data streams in behind it.
//
// Layout mirrors the real pages (same rail, paddings, max widths, grid) so
// nothing jumps when content arrives.

type Variant = "overview" | "holdings" | "insights";

function Skel({ className = "" }: { className?: string }) {
  return <div className={`clarity-skel ${className}`} />;
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="clarity-card p-5 md:p-6">
      <Skel className="h-4 w-24 mb-6" />
      <div className="flex flex-col gap-5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skel className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <Skel className="h-3.5 w-28" />
              <Skel className="h-3 w-16" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skel className="h-3.5 w-20" />
              <Skel className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TITLES: Record<Variant, string> = {
  overview: "Overview",
  holdings: "Holdings",
  insights: "Insights",
};

export function PageSkeleton({ variant }: { variant: Variant }) {
  const active: RailItem = variant;
  const maxWidth = variant === "insights" ? "max-w-[1000px]" : "max-w-[1240px]";

  return (
    <div className="clarity-shell flex-1 flex font-sans text-white">
      <SidebarRail active={active} displayName="" />
      <main
        className="flex-1 min-w-0 overflow-y-auto px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-[26px] pb-6"
        aria-busy="true"
        aria-label={`Loading ${TITLES[variant]}`}
      >
        <div className={`mx-auto ${maxWidth}`}>
          {/* Header: real title so the page is recognisable immediately */}
          <div className="flex items-center justify-between mb-6 md:mb-8 gap-4">
            <div>
              <Skel className="hidden md:block h-3 w-24 mb-2" />
              <div className="font-display font-bold text-[22px] md:text-[22px] text-white">
                {TITLES[variant]}
              </div>
            </div>
            {variant !== "insights" && (
              <Skel className="h-10 w-28 rounded-full" />
            )}
          </div>

          {variant === "overview" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 mb-5">
                <div className="flex flex-col gap-5 min-w-0">
                  <div className="clarity-card p-6">
                    <Skel className="h-3 w-20 mb-4" />
                    <Skel className="h-12 w-64 max-w-full mb-3" />
                    <Skel className="h-4 w-32" />
                  </div>
                  <div className="clarity-card p-6">
                    <div className="flex justify-between mb-5">
                      <Skel className="h-3 w-24" />
                      <Skel className="h-6 w-40 rounded-full" />
                    </div>
                    <Skel className="h-[200px] w-full rounded-2xl" />
                  </div>
                </div>
                <div className="clarity-card p-6 hidden lg:block">
                  <Skel className="h-3 w-20 mb-5" />
                  <Skel className="h-3 w-full mb-6 rounded-full" />
                  <div className="flex flex-col gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex justify-between">
                        <Skel className="h-3.5 w-20" />
                        <Skel className="h-3.5 w-12" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <TableSkeleton rows={5} />
            </>
          )}

          {variant === "holdings" && <TableSkeleton rows={8} />}

          {variant === "insights" && (
            <div className="clarity-card p-6">
              <Skel className="h-3 w-28 mb-4" />
              <Skel className="h-10 w-48 mb-6" />
              <Skel className="h-[220px] w-full rounded-2xl mb-5" />
              <Skel className="h-4 w-3/4 mb-2" />
              <Skel className="h-4 w-1/2" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
