"use client";

/**
 * Variant B8 — Orbital dots.
 * Dots orbit the core on concentric rings. Each ring freezes in place
 * as an asset completes — ending in a still constellation at 100%.
 * Inspired by spasoje.dev's dot rhythm + deliberate reveal.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Orbits from innermost → outermost. Each ring can hold multiple dots.
const ORBITS = [
  { r: 18, dots: 3, dur: 6.0, dir: 1 },
  { r: 28, dots: 5, dur: 9.0, dir: -1 },
  { r: 38, dots: 7, dur: 12.0, dir: 1 },
  { r: 48, dots: 9, dur: 15.0, dir: -1 },
];

export function AssemblyB8({ total, done }: { total: number; done: number }) {
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

  // How many orbits should be frozen right now?
  // Orbits freeze from outermost inward as `done` advances.
  const orbitsFrozen =
    total > 0 ? Math.floor((done / total) * ORBITS.length) : 0;

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
          className="absolute inset-0 w-full h-full overflow-visible"
          aria-hidden
        >
          {ORBITS.map((orbit, orbitIdx) => {
            // Outermost freezes first.
            const frozen = orbitIdx >= ORBITS.length - orbitsFrozen;
            return (
              <g
                key={orbitIdx}
                style={{
                  transformOrigin: "50% 50%",
                  transformBox: "fill-box",
                  animation: frozen
                    ? "none"
                    : `b8-spin-${orbit.dir === 1 ? "cw" : "ccw"} ${orbit.dur}s linear infinite`,
                }}
              >
                {/* Faint orbit track */}
                <circle
                  cx="50"
                  cy="50"
                  r={orbit.r}
                  fill="none"
                  stroke="#7FFFD4"
                  strokeOpacity={frozen ? 0.25 : 0.08}
                  strokeWidth="0.25"
                  style={{ transition: "stroke-opacity 0.4s ease" }}
                />
                {Array.from({ length: orbit.dots }).map((_, dotIdx) => {
                  const angle = (dotIdx / orbit.dots) * Math.PI * 2;
                  const cx = 50 + orbit.r * Math.cos(angle);
                  const cy = 50 + orbit.r * Math.sin(angle);
                  return (
                    <circle
                      key={dotIdx}
                      cx={cx}
                      cy={cy}
                      r={frozen ? 1.1 : 0.9}
                      fill="#7FFFD4"
                      style={{
                        filter: frozen
                          ? "drop-shadow(0 0 2px rgba(127,255,212,0.8))"
                          : "none",
                        transition: "r 0.4s ease",
                      }}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        <div
          aria-hidden
          className="relative z-10 w-16 h-16 rounded-full bg-[#7FFFD4] flex items-center justify-center"
          style={{
            boxShadow:
              "0 0 40px rgba(127,255,212,0.8), 0 0 80px rgba(127,255,212,0.3)",
            transform: complete ? "scale(1.12)" : "scale(1)",
            transition: "transform 0.7s cubic-bezier(0.22,1,0.36,1)",
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
  @keyframes b8-spin-cw  { to { transform: rotate(360deg);  } }
  @keyframes b8-spin-ccw { to { transform: rotate(-360deg); } }
`;
