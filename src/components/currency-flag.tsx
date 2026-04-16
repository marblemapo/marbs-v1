"use client";

import { getCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";

/**
 * Country flag for a currency code — rendered as an emoji glyph derived from
 * the country's two-letter ISO 3166 code. No HTTP, no dependencies, no
 * loading flash.
 *
 * Each letter A–Z has a "regional indicator" codepoint starting at U+1F1E6;
 * two of them together form a flag (e.g. H+K = 🇭🇰). "EU" resolves to the
 * European Union flag, which most modern platforms render.
 *
 * Fallback: if the currency isn't in our map, we show the gold-tinted
 * initials circle so nothing looks broken.
 *
 * Caveat: Windows Chrome/Edge don't ship color emoji for regional indicators
 * and render the flag as plain text ("HK"). On macOS / iOS / Android / most
 * Linux the flag renders correctly.
 */
export function CurrencyFlag({
  currency,
  size = 36,
  className,
}: {
  currency: string;
  size?: number;
  className?: string;
}) {
  const info = getCurrency(currency);

  if (!info?.country) {
    return (
      <div
        className={cn(
          "rounded-full bg-gold-dim text-gold font-bold flex items-center justify-center shrink-0",
          className,
        )}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(9, Math.round(size * 0.3)),
        }}
      >
        {currency.slice(0, 3)}
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 select-none leading-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        // Flag emoji glyphs don't fill their font-size box; slight
        // over-sizing lands a nicely-filled flag at the given container
        // size across macOS/iOS/Android.
        fontSize: Math.round(size * 0.95),
        lineHeight: 1,
      }}
      aria-label={`${info.name} flag`}
    >
      {countryToFlag(info.country)}
    </span>
  );
}

/**
 * ISO 3166 alpha-2 code → regional-indicator flag emoji.
 * Works for normal country codes. Returns empty string on bad input.
 */
function countryToFlag(countryCode: string): string {
  const cc = countryCode.toUpperCase();
  if (cc.length !== 2) return "";
  const A = "A".charCodeAt(0);
  const base = 0x1f1e6; // regional indicator "A"
  return String.fromCodePoint(
    base + (cc.charCodeAt(0) - A),
    base + (cc.charCodeAt(1) - A),
  );
}
