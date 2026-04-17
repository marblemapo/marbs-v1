"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CURRENCIES, type CurrencyOption } from "@/lib/currencies";
import { CurrencyFlag } from "@/components/currency-flag";

/**
 * Typeahead-style picker for an ISO 4217 currency. Rendered as a plain
 * <Input> with name/id/required props forwarded so it participates in
 * the standard FormData submit — no hidden-input trickery needed.
 *
 * Matches on code OR name, case-insensitive. Arrow keys + Enter + Escape
 * supported. Shows first 8 currencies when focused-empty as a browse list.
 */
export function CurrencySelect({
  id,
  name,
  required,
  defaultValue = "USD",
  placeholder = "USD",
  onValueChange,
}: {
  id?: string;
  name?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  /**
   * Fired on every query change (typing) and on pick. Lets callers that
   * aren't using normal FormData submit (e.g. OnboardingWizard) track the
   * current code in React state. The value is the raw query — callers
   * should normalize with trim().toUpperCase() before use.
   */
  onValueChange?: (value: string) => void;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter currencies by query (matches code or name). Blank query = browse.
  const filter = query.trim().toLowerCase();
  const matches = filter
    ? CURRENCIES.filter(
        (c) =>
          c.code.toLowerCase().includes(filter) ||
          c.name.toLowerCase().includes(filter),
      )
    : CURRENCIES;
  const visible = matches.slice(0, 8);

  // When the query matches an existing code exactly, don't re-show the
  // dropdown on every render — only when the user is actively typing.
  const exactMatch = CURRENCIES.find(
    (c) => c.code === query.trim().toUpperCase(),
  );

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  function pick(c: CurrencyOption) {
    setQuery(c.code);
    setOpen(false);
    onValueChange?.(c.code);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown") {
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % Math.max(1, visible.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(
        (h) => (h - 1 + Math.max(1, visible.length)) % Math.max(1, visible.length),
      );
    } else if (e.key === "Enter" && visible[highlighted]) {
      e.preventDefault();
      pick(visible[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        name={name}
        required={required}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
          onValueChange?.(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={3}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="h-11"
      />

      {/* Exact match hint — so user can see the name of what they've typed */}
      {exactMatch && !open && (
        <div className="text-xs text-text-muted mt-1">
          <span className="text-text-secondary">{exactMatch.code}</span> ·{" "}
          {exactMatch.name}
        </div>
      )}

      {open && visible.length > 0 && (
        <ul
          role="listbox"
          className={cn(
            "absolute z-50 left-0 right-0 top-full mt-1.5",
            "bg-surface border border-border rounded-lg shadow-lg overflow-hidden",
            "max-h-[280px] overflow-y-auto",
          )}
        >
          {visible.map((c, i) => (
            <li
              key={c.code}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                "px-3 py-2 flex items-center gap-3 cursor-pointer transition-colors",
                i === highlighted && "bg-surface-hover",
              )}
            >
              <CurrencyFlag currency={c.code} size={20} />
              <span className="font-display font-bold text-sm w-12 shrink-0">
                {c.code}
              </span>
              <span className="text-xs text-text-muted truncate flex-1">
                {c.name}
              </span>
              {c.symbol && (
                <span className="text-xs text-text-muted shrink-0">
                  {c.symbol}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && visible.length === 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-surface border border-border rounded-lg px-3 py-2.5">
          <div className="text-xs text-text-muted">
            No matches. You can still enter any 3-letter ISO code.
          </div>
        </div>
      )}
    </div>
  );
}
