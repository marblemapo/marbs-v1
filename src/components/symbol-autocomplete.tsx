"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/app/api/search/route";

/**
 * Finnhub hosts logos at a predictable URL pattern. Hit rate is ~60% —
 * works for US / UK / JP / CA, misses for DE / HK / KR / etc. We set the
 * <img src> to this URL and fall back to initials on error, so the cost
 * of a miss is one broken request per result with no extra API calls.
 */
function finnhubLogoUrl(symbol: string): string {
  return `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${encodeURIComponent(symbol)}.png`;
}

function ResultAvatar({ r }: { r: SearchResult }) {
  const [failed, setFailed] = useState(false);

  const src =
    !failed && r.thumb
      ? r.thumb
      : !failed && r.source === "finnhub"
        ? finnhubLogoUrl(r.symbol)
        : null;

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-5 h-5 rounded-full shrink-0 bg-white/5 object-contain"
      />
    );
  }

  return (
    <div className="w-5 h-5 rounded-full bg-gold-dim text-gold text-[9px] font-bold flex items-center justify-center shrink-0">
      {r.symbol.slice(0, 2)}
    </div>
  );
}

/**
 * Typeahead for stock/ETF/crypto symbols. Debounced 250ms, min 2 chars.
 * Arrows + Enter to pick; Esc to dismiss.
 *
 * Reports the *selected* SearchResult up to the parent via `onChange` so the
 * form knows the exact externalId (e.g. TSLA → yahoo lookup key = "TSLA";
 * BTC → coingecko slug = "bitcoin"). If the user submits without selecting,
 * the parent falls back to the raw query — addAsset's server-side search
 * safety net catches most of those.
 */

type Props = {
  assetClass: "equity" | "etf" | "crypto";
  baseCurrency?: string;
  onChange: (selection: SearchResult | null, rawQuery: string) => void;
  placeholder?: string;
};

export function SymbolAutocomplete({ assetClass, onChange, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const listId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch on debounced query change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    // If user typed exactly what they selected, don't re-search.
    if (selected && query === selected.symbol) {
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      abortRef.current = new AbortController();
      try {
        const klass = assetClass === "crypto" ? "crypto" : "equity";
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&class=${klass}`,
          { signal: abortRef.current.signal },
        );
        const data = await res.json();
        setResults(data.results ?? []);
        setHighlighted(0);
        setOpen(true);
      } catch {
        // Aborted or network — drop silently.
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, assetClass, selected]);

  // Close on outside click.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function pick(result: SearchResult) {
    setSelected(result);
    setQuery(result.symbol);
    setOpen(false);
    onChange(result, result.symbol);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown" && query.trim().length >= 2) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          onChange(null, e.target.value); // still report raw to parent
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0 && query.trim().length >= 2) setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className="h-11"
      />

      {/* Loading indicator — subtle dot in the input right margin */}
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gold pulse-live pointer-events-none" />
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className={cn(
            "absolute z-50 left-0 right-0 top-full mt-1.5",
            "bg-surface border border-border rounded-lg shadow-lg overflow-hidden",
            "max-h-[320px] overflow-y-auto",
          )}
        >
          {results.map((r, i) => (
            <li
              key={`${r.source}-${r.externalId}`}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => {
                // prevent input blur
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                "px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors",
                i === highlighted && "bg-surface-hover",
              )}
            >
              <ResultAvatar r={r} />
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm truncate">{r.symbol}</span>
                  {r.exchange && (
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">
                      {r.exchange}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted truncate">{r.name}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Empty state — only after a real query, not while typing */}
      {open && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-surface border border-border rounded-lg px-3 py-2.5">
          <div className="text-xs text-text-muted">
            No matches. You can still submit — we&apos;ll do our best to find it.
          </div>
        </div>
      )}
    </div>
  );
}
