"use client";

/**
 * Onboarding "portfolio assembly" overlay.
 *
 * Design goal: quiet-luxury finance aesthetic (think Sequence Markets) —
 * typography-first, slow motion, negative space. The previous orbital
 * particle version felt like a product demo; this one feels like the
 * moment before a market opens.
 *
 *   [ tiny pulsing eyebrow ]
 *   Big headline, typed one char at a time, with a blinking aqua caret
 *   · · ·
 *   scrolling ticker tape
 *   · · ·
 *   hairline progress bar + count
 *
 * z-[100] so it sits above any stray Sheet/Dialog portals.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function PortfolioAssembly({
  total,
  done,
}: {
  total: number;
  done: number;
}) {
  const complete = total > 0 && done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const message = complete ? "Net worth assembled." : "Gathering your net worth";
  const typed = useTypedText(message);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(127,255,212,0.06), transparent 70%), rgba(10,10,10,0.94)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <style>{css}</style>

      {/* Eyebrow */}
      <div
        className="mb-10 font-plex text-[11px] tracking-[0.3em] uppercase text-text-muted"
        style={{ animation: "pa-fade 600ms ease-out 200ms backwards" }}
      >
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full bg-[#7FFFD4] mr-2 align-middle"
          style={{
            boxShadow: "0 0 10px #7FFFD4",
            animation: "pa-pulse 1.6s ease-in-out infinite",
          }}
        />
        {complete ? "Ready" : "Synchronizing"}
      </div>

      {/* Typed headline */}
      <h1
        className={cn(
          "font-display font-bold tracking-[-0.03em] text-center leading-[1.05]",
          "text-[40px] sm:text-[56px] md:text-[72px] lg:text-[88px]",
          "max-w-[900px]",
        )}
      >
        {typed}
        <span
          aria-hidden
          className="inline-block w-[0.08em] h-[0.8em] ml-1 align-baseline bg-[#7FFFD4]"
          style={{
            animation: "pa-caret 800ms steps(2, start) infinite",
            transform: "translateY(0.08em)",
            boxShadow: "0 0 8px rgba(127,255,212,0.5)",
          }}
        />
      </h1>

      {/* Ticker tape */}
      <div
        className="mt-14 w-full max-w-[520px] overflow-hidden select-none"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent, black 20%, black 80%, transparent)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, black 20%, black 80%, transparent)",
        }}
      >
        <div
          className="flex gap-10 font-plex text-[11px] tracking-[0.2em] uppercase text-text-muted whitespace-nowrap"
          style={{ animation: "pa-marquee 22s linear infinite" }}
        >
          {Array.from({ length: 2 }).flatMap((_, copy) =>
            [
              "STOCKS",
              "·",
              "CRYPTO",
              "·",
              "CASH",
              "·",
              "FX",
              "·",
              "ON-CHAIN",
              "·",
            ].map((t, i) => (
              <span
                key={`${copy}-${i}`}
                className={t === "·" ? "text-text-muted/40" : ""}
              >
                {t}
              </span>
            )),
          )}
        </div>
      </div>

      {/* Hairline progress */}
      <div className="mt-16 w-full max-w-[360px] flex flex-col gap-3">
        <div className="relative h-px bg-white/[0.08] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-[#7FFFD4] transition-[width] duration-[600ms] ease-out"
            style={{
              width: `${pct}%`,
              boxShadow: "0 0 12px rgba(127,255,212,0.6)",
            }}
          />
        </div>
        <div className="flex items-center justify-between font-plex text-[10px] uppercase tracking-[0.2em] text-text-muted tabular-nums">
          <span>{complete ? "Complete" : "In progress"}</span>
          <span>
            {done} / {total}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Types the target text one character at a time, ~42ms per char. Resets
 * when target changes (e.g. "Gathering…" → "Net worth assembled.").
 */
function useTypedText(target: string) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setShown(target.slice(0, i));
      if (i >= target.length) window.clearInterval(interval);
    }, 42);
    return () => window.clearInterval(interval);
  }, [target]);

  return shown;
}

const css = `
  @keyframes pa-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.7; transform: scale(1.35); }
  }
  @keyframes pa-caret {
    0%, 49%   { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
  @keyframes pa-fade {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pa-marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
`;
