"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { addAsset, type AddAssetInput } from "@/app/actions/assets";
import { SymbolAutocomplete } from "@/components/symbol-autocomplete";
import type { SearchResult } from "@/app/api/search/route";
import { CurrencySelect } from "@/components/currency-select";
import { getCurrency } from "@/lib/currencies";

// UI class — the tab the user picks. The DB enum has a separate "etf" value
// which we infer from the Finnhub search result, so there's no ETF tab here.
type UiClass = "stock" | "crypto" | "cash";

const CLASSES: { id: UiClass; label: string; hint: string }[] = [
  {
    id: "stock",
    label: "Stock",
    hint: "Stocks and ETFs — AAPL, VTI, 0700.HK, VWRL.L",
  },
  { id: "crypto", label: "Crypto", hint: "BTC, ETH, stablecoins" },
  { id: "cash", label: "Cash", hint: "Bank, savings, money market" },
];

export function AddAssetDrawer({ baseCurrency = "USD" }: { baseCurrency?: string }) {
  const [open, setOpen] = useState(false);
  const [uiClass, setUiClass] = useState<UiClass>("stock");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Autocomplete state (lifted out of the typeahead so we can submit it).
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [rawSymbol, setRawSymbol] = useState<string>("");

  function reset() {
    setUiClass("stock");
    setError(null);
    setPicked(null);
    setRawSymbol("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    // Symbol: prefer the autocomplete selection (canonical ticker + externalId).
    // Fall back to the raw query if user didn't pick from the dropdown.
    const symbol =
      (picked?.symbol ?? rawSymbol).trim().toUpperCase() || null;

    // Advanced override for crypto still wins if user filled it.
    const advExternalId =
      (form.get("externalId") as string | null)?.trim() || null;

    const quantity = Number(form.get("quantity"));
    const nativeCurrency = ((form.get("nativeCurrency") as string) ?? baseCurrency)
      .trim()
      .toUpperCase();

    // For cash assets the Name is optional. When blank, default to the
    // currency's human name ("Canadian Dollar") — clean on the dashboard
    // without duplicating the CASH tag we already show.
    //
    // For cash we also set the *symbol* to the currency code (CAD, HKD, ...)
    // so the row renders "CAD · CASH" in the big slot instead of the long
    // name. The name stays as the secondary label.
    const rawName = (form.get("name") as string | null)?.trim();
    const ccyInfo = getCurrency(nativeCurrency);
    const name =
      rawName ||
      picked?.name ||
      (uiClass === "cash" ? ccyInfo?.name ?? nativeCurrency : symbol) ||
      "";
    const effectiveSymbol =
      symbol ?? (uiClass === "cash" ? nativeCurrency : null);

    // Resolve:
    //   assetClass (DB enum): picked.assetClass if we have a Finnhub match
    //     ("equity" | "etf"), otherwise fall back to "equity" for the Stock
    //     tab. Crypto / Cash are fixed by the tab choice.
    //   priceSource: finnhub for stock-tab, coingecko for crypto, manual for cash.
    let priceSource: AddAssetInput["priceSource"];
    let externalId: string | null = advExternalId ?? picked?.externalId ?? null;
    let assetClass: AddAssetInput["assetClass"];
    if (uiClass === "stock") {
      priceSource = "finnhub";
      assetClass = picked?.assetClass === "etf" ? "etf" : "equity";
    } else if (uiClass === "crypto") {
      priceSource = "coingecko";
      assetClass = "crypto";
    } else {
      priceSource = "manual";
      externalId = null;
      assetClass = "cash";
    }

    const input: AddAssetInput = {
      name: name || "Unnamed asset",
      symbol: effectiveSymbol,
      assetClass,
      nativeCurrency,
      externalId,
      priceSource,
      quantity,
      logo: picked?.thumb ?? null,
    };

    startTransition(async () => {
      const res = await addAsset(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      reset();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <SheetTrigger
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/80 transition-colors",
        )}
      >
        + Add asset
      </SheetTrigger>

      <SheetContent side="right" className="f3-theme w-full sm:max-w-[440px] flex flex-col gap-0 p-0 border-l border-white/[0.08]">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="font-display text-2xl font-bold tracking-tight">
            Add an asset
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-5 px-6 pb-6 overflow-y-auto">
          {/* Class picker */}
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              Type
            </Label>
            <div className="grid grid-cols-3 gap-1.5">
              {CLASSES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setUiClass(c.id);
                    // Changing tabs invalidates any in-flight pick — the
                    // search surface is different.
                    setPicked(null);
                    setRawSymbol("");
                  }}
                  className={cn(
                    "h-10 rounded-lg text-sm font-semibold transition-colors border",
                    uiClass === c.id
                      ? "bg-gold text-primary-foreground border-gold"
                      : "bg-surface text-text-secondary border-border hover:bg-surface-hover",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              {CLASSES.find((c) => c.id === uiClass)?.hint}
            </p>
          </div>

          {/* Symbol / ticker with typeahead */}
          {uiClass !== "cash" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
                Search
              </Label>
              <SymbolAutocomplete
                assetClass={uiClass}
                onChange={(selection, raw) => {
                  setPicked(selection);
                  setRawSymbol(raw);
                }}
                placeholder={
                  uiClass === "crypto"
                    ? "Type to search — btc, eth, solana…"
                    : "Type to search — tesla, apple, 0700…"
                }
              />
              <p className="text-xs text-text-muted">
                {picked ? (
                  <>
                    Picked <span className="text-foreground font-semibold">{picked.symbol}</span>
                    {picked.exchange && <> on <span className="text-foreground">{picked.exchange}</span></>}
                    {" · "}
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(null);
                        setRawSymbol("");
                      }}
                      className="underline hover:text-foreground"
                    >
                      clear
                    </button>
                  </>
                ) : (
                  <>Name or ticker — we&apos;ll find it.</>
                )}
              </p>
            </div>
          )}

          {/* Cash account name (optional — defaults to "{CCY} cash") */}
          {uiClass === "cash" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
                Account name
                <span className="text-text-muted/60 normal-case tracking-normal font-normal ml-1.5">
                  · optional
                </span>
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Chase checking · HSBC savings"
                autoFocus
                autoComplete="off"
                className="h-11"
              />
              <p className="text-xs text-text-muted">
                Leave blank and we&apos;ll call it &ldquo;CURRENCY cash&rdquo;.
              </p>
            </div>
          )}

          {/* Quantity / balance */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity" className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              {uiClass === "cash" ? "Balance" : "Quantity"}
            </Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="any"
              min="0"
              placeholder={uiClass === "cash" ? "12000" : "100"}
              required
              inputMode="decimal"
              className="h-11 tabular-nums"
            />
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nativeCurrency" className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              Native currency
            </Label>
            <CurrencySelect
              id="nativeCurrency"
              name="nativeCurrency"
              required
              defaultValue={uiClass === "crypto" ? "USD" : baseCurrency}
              placeholder="USD"
            />
            <p className="text-xs text-text-muted">
              {uiClass === "stock"
                ? "For LSE stocks use GBP, HKEX use HKD, etc."
                : uiClass === "crypto"
                  ? "Quote currency — usually USD."
                  : "Which currency this cash is denominated in."}
            </p>
          </div>

          {/* Advanced: CoinGecko slug */}
          {uiClass === "crypto" && (
            <details className="flex flex-col gap-1.5">
              <summary className="text-[11px] text-text-muted uppercase tracking-wider font-medium cursor-pointer select-none">
                Advanced · CoinGecko slug
              </summary>
              <Input
                name="externalId"
                placeholder="e.g. bitcoin, ethereum, polkadot"
                autoComplete="off"
                spellCheck={false}
                className="h-11 mt-2"
              />
            </details>
          )}

          {error && (
            <div className="text-sm text-loss leading-relaxed p-3 rounded-lg bg-loss/10 border border-loss/20">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 mt-auto pt-4">
            <Button
              type="button"
              variant="ghost"
              className="h-11 flex-1 font-semibold"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 flex-1 font-semibold"
              disabled={pending}
            >
              {pending ? "Adding…" : "Add asset"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
