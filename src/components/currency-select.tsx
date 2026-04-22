"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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
  hideLabel = false,
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
  /**
   * Suppresses the "USD · US Dollar" helper line under the field. In row
   * layouts where this picker sits next to other inputs (onboarding cash
   * rows), the helper pushes the picker's visual height past the sibling
   * and breaks vertical alignment — the flag reads as "dropped to the
   * bottom." Hide it in those cases; keep it in single-field layouts.
   */
  hideLabel?: boolean;
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
      {/* Flag sits inside the input when the code matches a known currency.
          Positioned absolutely so the input's own padding handles text offset.
          pointer-events-none so clicking the flag area lands in the input. */}
      {exactMatch && (
        <div
          className="absolute left-3 top-1/2 pointer-events-none z-10"
          style={{ transform: "translateY(calc(-50% - 1px))" }}
        >
          <CurrencyFlag currency={exactMatch.code} size={16} />
        </div>
      )}
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
        className={cn("h-11 pr-9", exactMatch && "pl-10")}
      />

      {/* Chevron affordance — clicking it toggles the list. Kept visually
          separate from the flag (which is a read-only badge) so the
          interactive surface is obvious. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? "Close currency list" : "Open currency list"}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
      >
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Exact match hint — so user can see the name of what they've typed */}
      {exactMatch && !open && !hideLabel && (
        <div className="text-xs text-text-muted mt-1">
          <span className="text-text-secondary">{exactMatch.code}</span> ·{" "}
          {exactMatch.name}
        </div>
      )}

      {open && visible.length > 0 && (
        <ul
          role="listbox"
          className={cn(
            "absolute z-50 left-0 top-full mt-1.5",
            // Fixed min-width so narrow containers (128px currency col in the
            // onboarding wizard) don't clip "USD · US Dollar". Opaque surface
            // ensures anything behind — like the balance input to the right —
            // never bleeds through.
            "min-w-[240px] w-max max-w-[320px]",
            "bg-[#2C2C2E] border border-white/[0.12] rounded-lg shadow-2xl overflow-hidden",
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
