"use client";

/**
 * Variant A — Quiet.
 * Typography + negative space. No SVG, no graphics. Feels like a luxury
 * watch face: almost nothing happens, what happens is intentional.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function AssemblyA({ total, done }: { total: number; done: number }) {
  const complete = total > 0 && done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const message = complete ? "Assembled." : "Gathering.";
  const typed = useTypedText(message);

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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
      style={{ background: "rgba(8,10,10,0.98)" }}
    >
      <style>{css}</style>

      <div
        className="absolute top-10 font-plex text-[11px] tracking-[0.4em] uppercase text-text-muted/60"
        style={{ animation: "aa-fade 500ms ease-out" }}
      >
        Wealth
      </div>

      <h1
        className={cn(
          "font-display font-bold tracking-[-0.04em] text-center leading-[0.95]",
          "text-[56px] sm:text-[96px] md:text-[128px] lg:text-[160px]",
        )}
      >
        {typed}
      </h1>

      <div
        className="absolute bottom-10 flex flex-col items-center gap-3 w-full max-w-[240px]"
        style={{ animation: "aa-fade 500ms ease-out 200ms backwards" }}
      >
        <div className="relative h-px w-full bg-white/[0.06] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-[#7FFFD4] transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="font-plex text-[10px] uppercase tracking-[0.3em] text-text-muted tabular-nums">
          {done} / {total}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

function useTypedText(target: string) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(target.slice(0, i));
      if (i >= target.length) window.clearInterval(id);
    }, 60);
    return () => window.clearInterval(id);
  }, [target]);
  return shown;
}

const css = `
  @keyframes aa-fade {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;
