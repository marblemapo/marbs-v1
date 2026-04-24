"use client";

/**
 * Variant C — Data waterfall.
 * Columns of scrolling numbers flanking the viewport edges. Feels like a
 * trading terminal warming up. Bloomberg vibes, more graphic than A or B.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const COLUMN_COUNT = 14; // 7 per side
const ROWS_PER_COLUMN = 18;

export function AssemblyC({ total, done }: { total: number; done: number }) {
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

  // Generate stable column contents so re-renders (counter ticks) don't
  // reshuffle the streams.
  const columns = useMemo(
    () =>
      Array.from({ length: COLUMN_COUNT }, (_, col) => ({
        id: col,
        side: col < COLUMN_COUNT / 2 ? "left" : "right",
        rows: Array.from({ length: ROWS_PER_COLUMN }, () => {
          // Mix of tickers + random numbers + currency glyphs
          const r = Math.random();
          if (r < 0.2) {
            const tickers = [
              "TSLA",
              "AAPL",
              "BTC",
              "ETH",
              "VOO",
              "QQQ",
              "0700",
              "2330",
              "BABA",
              "HSBC",
            ];
            return tickers[Math.floor(Math.random() * tickers.length)];
          }
          if (r < 0.3) return ["$", "€", "£", "¥", "₩", "₿"][Math.floor(Math.random() * 6)];
          // Random float for financial-looking numbers
          const n = (Math.random() * 99999).toFixed(2);
          return n;
        }),
        duration: 18 + Math.random() * 14, // 18-32s
        delay: Math.random() * -20,
      })),
    [],
  );

  if (!mounted) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(127,255,212,0.10), transparent 70%), rgba(6,8,8,0.97)",
      }}
    >
      <style>{css}</style>

      {/* Scrolling columns (behind content) */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        {columns.map((c) => {
          const columnWidth = 100 / (COLUMN_COUNT / 2); // % of half-screen
          const colIndex = c.side === "left" ? c.id : c.id - COLUMN_COUNT / 2;
          const left =
            c.side === "left"
              ? `${colIndex * columnWidth}%`
              : `${50 + colIndex * columnWidth}%`;
          return (
            <div
              key={c.id}
              className="absolute top-0 h-full flex flex-col font-plex text-[10px] sm:text-[11px] text-[#7FFFD4]/50 tabular-nums whitespace-nowrap leading-[1.9]"
              style={{
                left,
                width: `${columnWidth}%`,
                animation: `cc-drip ${c.duration}s linear ${c.delay}s infinite`,
                textAlign: "center",
              }}
            >
              {/* Double the list so the loop is seamless */}
              {[...c.rows, ...c.rows].map((r, i) => (
                <span
                  key={i}
                  className={
                    i === Math.floor(ROWS_PER_COLUMN / 2)
                      ? "text-[#7FFFD4]"
                      : ""
                  }
                >
                  {r}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* Center vignette mask so columns fade near the headline */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 35% at 50% 50%, rgba(6,8,8,0.95), rgba(6,8,8,0.75) 40%, transparent 70%)",
        }}
      />

      {/* Foreground content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="font-plex text-[10px] tracking-[0.4em] uppercase text-[#7FFFD4]">
          ● {complete ? "Ready" : "Syncing"}
        </div>
        <h1 className="font-display text-[48px] sm:text-[72px] md:text-[96px] font-bold tracking-[-0.03em] text-center leading-[1]">
          {complete ? "Assembled." : "Gathering"}
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

const css = `
  @keyframes cc-drip {
    from { transform: translateY(-50%); }
    to   { transform: translateY(0%); }
  }
`;
