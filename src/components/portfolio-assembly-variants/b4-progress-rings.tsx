"use client";

/**
 * Variant B4 — Progress-locked rings.
 * One ring materializes and locks in place per asset completed.
 * Motion is tied to real progress, not a loop.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function AssemblyB4({ total, done }: { total: number; done: number }) {
  const complete = total > 0 && done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  if (!mounted) return null;

  const rings = Array.from({ length: total }, (_, i) => i);

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, rgba(127,255,212,0.08), transparent 65%), rgba(8,10,10,0.96)",
      }}
    >
      <style>{css}</style>

      <div className="relative w-[min(90vw,560px)] h-[min(90vw,560px)] flex items-center justify-center">
        {rings.map((i) => {
          const ringDone = i < done;
          // Evenly distribute ring sizes from ~25% to 100%.
          const size = 25 + (i / Math.max(total - 1, 1)) * 75;
          return (
            <div
              key={i}
              aria-hidden
              className="absolute rounded-full border"
              style={{
                width: `${size}%`,
                height: `${size}%`,
                borderColor: ringDone
                  ? "#7FFFD4"
                  : "rgba(127,255,212,0.12)",
                borderWidth: ringDone ? 2 : 1,
                transform: ringDone ? "scale(1)" : "scale(0.94)",
                opacity: ringDone ? 1 : 0.5,
                transition:
                  "transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease, border-color 0.4s ease, border-width 0.4s ease",
                boxShadow: ringDone
                  ? "0 0 20px rgba(127,255,212,0.25)"
                  : "none",
                animation: ringDone ? "b4-lock 0.6s ease-out" : "none",
              }}
            />
          );
        })}

        <div
          aria-hidden
          className="relative z-10 w-20 h-20 rounded-full bg-[#7FFFD4] flex items-center justify-center"
          style={{
            boxShadow:
              "0 0 40px rgba(127,255,212,0.8), 0 0 80px rgba(127,255,212,0.3)",
            transform: complete ? "scale(1.1)" : "scale(1)",
            transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <span className="font-display text-3xl font-bold text-black">W</span>
        </div>
      </div>

      <div className="absolute bottom-[14vh] flex flex-col items-center gap-4">
        <div className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-center">
          {complete ? "Net worth assembled." : "Assembling your net worth…"}
        </div>
        <div className="flex items-center gap-3 font-plex text-[11px] uppercase tracking-[0.25em] text-text-muted tabular-nums">
          <span>{pct.toString().padStart(3, "0")}%</span>
          <span className="text-text-muted/40">·</span>
          <span>
            {done} / {total}
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

const css = `
  @keyframes b4-lock {
    0%   { transform: scale(0.6); opacity: 0;   }
    60%  { transform: scale(1.05); opacity: 1;  }
    100% { transform: scale(1);    opacity: 1;  }
  }
`;
