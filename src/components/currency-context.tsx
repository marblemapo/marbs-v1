"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CurrencyCtx = {
  /** The currency the user is currently viewing everything in. */
  currency: string;
  setCurrency: (c: string) => void;

  /** Their profile default — the one we fall back to if localStorage is empty. */
  baseCurrency: string;

  /** All currencies the user has holdings in (plus base). Drives the pill toggle. */
  currencies: string[];

  /** FX rate map from fetchFxRates(). null = fetch failed, degrade gracefully. */
  fxRates: Record<string, number> | null;
};

const Ctx = createContext<CurrencyCtx | null>(null);

const STORAGE_KEY = "marbs:view-currency";

/**
 * Provides the view currency + FX rates to all descendants. Pill toggle in
 * the hero and row rendering in AssetsList both read from this, so toggling
 * anywhere re-renders everything in the new currency.
 *
 * Persistence: localStorage, per-browser. A proper "save as default" that
 * hits profiles.base_currency is deferred.
 */
export function CurrencyProvider({
  baseCurrency,
  currencies,
  fxRates,
  children,
}: {
  baseCurrency: string;
  currencies: string[];
  fxRates: Record<string, number> | null;
  children: ReactNode;
}) {
  const [currency, setCurrency] = useState<string>(baseCurrency);

  // Restore last-used on mount (client only).
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    if (saved && currencies.includes(saved)) setCurrency(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, currency);
    }
  }, [currency]);

  const value = useMemo(
    () => ({ currency, setCurrency, baseCurrency, currencies, fxRates }),
    [currency, baseCurrency, currencies, fxRates],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCurrency(): CurrencyCtx {
  const v = useContext(Ctx);
  if (!v)
    throw new Error("useCurrency must be used inside a CurrencyProvider");
  return v;
}
