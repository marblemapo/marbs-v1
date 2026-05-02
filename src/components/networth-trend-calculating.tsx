"use client";

import { useEffect, useState } from "react";

/**
 * Client component that shows a spinner while the net-worth backfill is
 * in-flight. Auto-reloads the page after `REFRESH_AFTER_MS` so the user
 * never has to manually refresh — the chart just appears.
 */
const REFRESH_AFTER_MS = 40_000; // 40s — enough for the backfill to finish

export function NetWorthTrendCalculating() {
  const [remaining, setRemaining] = useState(
    Math.ceil(REFRESH_AFTER_MS / 1000),
  );

  useEffect(() => {
    // Countdown → auto-reload when it hits 0.
    const interval = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(interval);
          window.location.reload();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="flex flex-col gap-4 p-7 rounded-2xl bg-[#0A0A0A] border border-white/[0.08]">
      <div className="flex items-center gap-2">
        <span className="font-plex text-[11px] text-text-muted uppercase tracking-[0.18em] font-medium">
          Trend
        </span>
      </div>
      <div className="h-[200px] flex flex-col items-center justify-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-[#7FFFD4]/30 border-t-[#7FFFD4] animate-spin" />
        <p className="font-plex text-[12px] text-text-muted text-center">
          Calculating your net worth history…
        </p>
        <p className="font-plex text-[11px] text-text-muted/50 text-center">
          Auto-refreshing in {remaining}s
        </p>
      </div>
    </section>
  );
}
