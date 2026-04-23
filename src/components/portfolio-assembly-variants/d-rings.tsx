"use client";

/**
 * Variant D — Portfolio rings.
 * One SVG ring per asset, arranged in an arc above the headline. Each
 * ring fills from 0 → 100% as that asset resolves. Feels purposeful —
 * the motion IS the data. No decorative noise.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function AssemblyD({ total, done }: { total: number; done: number }) {
  const complete = total > 0 && done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  // Per-ring animated progress — each ring fills as its asset settles.
  const rings = Array.from({ length: total }, (_, i) => ({
    filled: i < done,
    // Stagger a 200ms delay per ring so the fills cascade instead of
    // snapping all at once when `done` jumps multiple units.
    delay: i * 100,
  }));

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

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-10 px-6"
      style={{
        background:
          "radial-gradient(ellipse 60% 45% at 50% 40%, rgba(127,255,212,0.07), transparent 65%), rgba(8,10,10,0.97)",
      }}
    >
      <style>{css}</style>

      <div className="font-plex text-[10px] tracking-[0.4em] uppercase text-[#7FFFD4]">
        ● {complete ? "Complete" : "Syncing"}
      </div>

      {/* Ring row */}
      <div className="flex items-center justify-center flex-wrap gap-5 max-w-[640px]">
        {rings.map((r, i) => (
          <svg
            key={i}
            width="68"
            height="68"
            viewBox="0 0 68 68"
            className="shrink-0"
            style={{ filter: r.filled ? "drop-shadow(0 0 10px rgba(127,255,212,0.6))" : "none" }}
          >
            {/* Track */}
            <circle
              cx="34"
              cy="34"
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="3"
            />
            {/* Fill */}
            <circle
              cx="34"
              cy="34"
              r={RING_RADIUS}
              fill="none"
              stroke="#7FFFD4"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={r.filled ? 0 : RING_CIRCUMFERENCE}
              transform="rotate(-90 34 34)"
              style={{
                transition: `stroke-dashoffset 700ms cubic-bezier(0.16, 1, 0.3, 1) ${r.delay}ms`,
              }}
            />
            {/* Center dot when filled */}
            <circle
              cx="34"
              cy="34"
              r="3"
              fill="#7FFFD4"
              opacity={r.filled ? 1 : 0}
              style={{
                transition: `opacity 400ms ease-out ${r.delay + 500}ms`,
              }}
            />
          </svg>
        ))}
      </div>

      {/* Headline */}
      <div className="flex flex-col items-center gap-3">
        <h1 className="font-display text-[40px] sm:text-[60px] md:text-[80px] font-bold tracking-[-0.03em] text-center leading-[1]">
          {complete ? "Net worth assembled." : "Assembling."}
        </h1>
        <div className="flex items-center gap-4 font-plex text-[11px] uppercase tracking-[0.3em] text-text-muted tabular-nums">
          <span>{pct.toString().padStart(3, "0")}%</span>
          <span className="text-text-muted/30">·</span>
          <span>
            {done} / {total}
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

const css = ``;
