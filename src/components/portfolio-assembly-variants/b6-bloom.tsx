"use client";

/**
 * Variant B6 — Core bloom.
 * Rings are subtle. The core is a disc of 6 wedges that rotate
 * outward like petals at 100%, revealing the center.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function AssemblyB6({ total, done }: { total: number; done: number }) {
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

  const wedgeCount = 6;
  const wedges = Array.from({ length: wedgeCount }, (_, i) => i);

  // Build a single wedge path (pie slice from center).
  // Circle radius 46 in viewBox 100x100, sweep angle = 360/6 = 60deg.
  const sweep = (2 * Math.PI) / wedgeCount;
  const r = 46;
  const cx = 50;
  const cy = 50;
  // Wedge pointing "up" — from -sweep/2 to +sweep/2 around -90deg.
  const a0 = -Math.PI / 2 - sweep / 2;
  const a1 = -Math.PI / 2 + sweep / 2;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const wedgePath = `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;

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
        {/* Subtle backdrop rings */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden
            className="absolute rounded-full border border-[#7FFFD4]/15"
            style={{
              width: `${50 + i * 22}%`,
              height: `${50 + i * 22}%`,
              animation: `b6-pulse 4s ease-in-out ${i * 0.6}s infinite`,
            }}
          />
        ))}

        {/* Wedge core */}
        <div className="relative z-10 w-32 h-32 flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full overflow-visible"
            aria-hidden
          >
            {wedges.map((i) => {
              const rot = (360 / wedgeCount) * i;
              return (
                <path
                  key={i}
                  d={wedgePath}
                  fill="#7FFFD4"
                  style={{
                    transformOrigin: "50% 50%",
                    transform: complete
                      ? `rotate(${rot}deg) translateY(-14%)`
                      : `rotate(${rot}deg) translateY(0%)`,
                    opacity: complete ? 0.85 : 1,
                    transition:
                      "transform 0.9s cubic-bezier(0.22,1,0.36,1), opacity 0.6s ease",
                    filter:
                      "drop-shadow(0 0 10px rgba(127,255,212,0.55))",
                  }}
                />
              );
            })}
          </svg>
          <span
            className="relative font-display text-3xl font-bold text-black"
            style={{
              opacity: complete ? 0 : 1,
              transition: "opacity 0.4s ease",
            }}
          >
            W
          </span>
          {/* Revealed center at complete */}
          <div
            aria-hidden
            className="absolute w-6 h-6 rounded-full bg-white"
            style={{
              opacity: complete ? 1 : 0,
              transform: complete ? "scale(1)" : "scale(0.4)",
              transition:
                "opacity 0.5s ease 0.3s, transform 0.7s cubic-bezier(0.22,1,0.36,1) 0.3s",
              boxShadow:
                "0 0 30px rgba(255,255,255,0.9), 0 0 60px rgba(127,255,212,0.6)",
            }}
          />
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
  @keyframes b6-pulse {
    0%, 100% { opacity: 0.2; transform: scale(1);    }
    50%      { opacity: 0.5; transform: scale(1.04); }
  }
`;
