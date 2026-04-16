"use client";

import { useState } from "react";
import { getCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";

/**
 * Country flag avatar for a currency code, served by FlagCDN
 * (flagcdn.com — free, reliable, cached globally). Cropped to a
 * circle with object-cover; the crop keeps the most-recognizable
 * element centered for most major flags.
 *
 * Falls back to the gold-initials circle when:
 *   - the currency isn't in our map
 *   - FlagCDN returns 404 (via onError)
 *
 * Size choice: FlagCDN serves at exact widths. We pick w40 for
 * ≤20px renders, w80 for larger. Anything beyond 40px gets w160.
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
  const [failed, setFailed] = useState(false);
  const info = getCurrency(currency);

  if (!info?.country || failed) {
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

  // Pick a sensible source width — FlagCDN only serves discrete sizes.
  const flagW = size <= 20 ? 40 : size <= 40 ? 80 : 160;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w${flagW}/${info.country}.png`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "rounded-full object-cover shrink-0 bg-white/5",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
