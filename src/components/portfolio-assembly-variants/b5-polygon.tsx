"use client";

/**
 * Variant B5 — Polygonal vault.
 * Hexagonal rings pulse outward from the core — same motion as B,
 * but more mechanical and less spiritual.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    // Flat-top hexagon (rotate -30deg from default pointy-top).
    const angle = (Math.PI / 3) * i;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

export function AssemblyB5({ total, done }: { total: number; done: number }) {
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

  const points = hexPoints(50, 50, 48);

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
          {[0, 1, 2, 3, 4].map((i) => (
            <polygon
              key={i}
              points={points}
              fill="none"
              stroke="#7FFFD4"
              strokeWidth="0.6"
              style={{
                transformOrigin: "50% 50%",
                animation: `b5-hex 3.2s ease-out ${i * 0.64}s infinite`,
              }}
            />
          ))}
        </svg>

        <div
          aria-hidden
          className="relative z-10 w-20 h-20 flex items-center justify-center"
          style={{
            animation: "b5-core 1.8s ease-in-out infinite",
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full"
            aria-hidden
          >
            <polygon
              points={hexPoints(50, 50, 46)}
              fill="#7FFFD4"
              style={{
                filter:
                  "drop-shadow(0 0 14px rgba(127,255,212,0.8)) drop-shadow(0 0 28px rgba(127,255,212,0.3))",
              }}
            />
          </svg>
          <span className="relative font-display text-3xl font-bold text-black">W</span>
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
  @keyframes b5-hex {
    0%   { transform: scale(0.12); opacity: 0.8; stroke-width: 1.6; }
    80%  { opacity: 0.08; stroke-width: 0.8; }
    100% { transform: scale(1);    opacity: 0;   stroke-width: 0.6; }
  }
  @keyframes b5-core {
    0%, 100% { transform: scale(1);    }
    50%      { transform: scale(1.12); }
  }
`;
