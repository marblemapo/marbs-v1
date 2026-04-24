"use client";

/**
 * Variant B3 — Tumblers.
 * Concentric arc segments rotating at different speeds — a vault
 * combination lock in motion. Arcs lock (stop rotating) on complete.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function AssemblyB3({ total, done }: { total: number; done: number }) {
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

  // Each tumbler: radius %, arc length (0-1), speed (s), direction.
  const tumblers = [
    { r: 46, arc: 0.55, dur: 4.0, dir: 1 },
    { r: 36, arc: 0.35, dur: 2.8, dir: -1 },
    { r: 26, arc: 0.7, dur: 5.2, dir: 1 },
    { r: 16, arc: 0.25, dur: 2.2, dir: -1 },
  ];

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
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          {tumblers.map((t, i) => {
            const circumference = 2 * Math.PI * t.r;
            const dash = circumference * t.arc;
            const gap = circumference - dash;
            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={t.r}
                fill="none"
                stroke="#7FFFD4"
                strokeWidth="0.5"
                strokeDasharray={`${dash} ${gap}`}
                style={{
                  transformOrigin: "50% 50%",
                  animation: complete
                    ? "none"
                    : `b3-spin-${t.dir === 1 ? "cw" : "ccw"} ${t.dur}s linear infinite`,
                  opacity: 0.85,
                  transition: "transform 0.6s ease-out",
                }}
              />
            );
          })}
        </svg>

        <div
          aria-hidden
          className="relative z-10 w-16 h-16 rounded-full bg-[#7FFFD4] flex items-center justify-center"
          style={{
            boxShadow:
              "0 0 40px rgba(127,255,212,0.8), 0 0 80px rgba(127,255,212,0.3)",
            transform: complete ? "scale(1.15)" : "scale(1)",
            transition: "transform 0.8s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <span className="font-display text-2xl font-bold text-black">W</span>
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
  @keyframes b3-spin-cw  { to { transform: rotate(360deg);  } }
  @keyframes b3-spin-ccw { to { transform: rotate(-360deg); } }
`;
