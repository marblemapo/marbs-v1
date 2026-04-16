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

type AssetClass = "equity" | "etf" | "crypto" | "cash";

const CLASSES: { id: AssetClass; label: string; hint: string }[] = [
  { id: "equity", label: "Stock", hint: "Single company (AAPL, 0700.HK)" },
  { id: "etf", label: "ETF", hint: "Fund (VTI, QQQ, VWRL.L)" },
  { id: "crypto", label: "Crypto", hint: "BTC, ETH, stablecoins" },
  { id: "cash", label: "Cash", hint: "Bank, savings, money market" },
];

export function AddAssetDrawer({ baseCurrency = "USD" }: { baseCurrency?: string }) {
  const [open, setOpen] = useState(false);
  const [assetClass, setAssetClass] = useState<AssetClass>("equity");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Autocomplete state (lifted out of the typeahead so we can submit it).
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [rawSymbol, setRawSymbol] = useState<string>("");

  function reset() {
    setAssetClass("equity");
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

    const name =
      (form.get("name") as string | null)?.trim() ||
      picked?.name ||
      symbol ||
      "";
    const quantity = Number(form.get("quantity"));
    const nativeCurrency = ((form.get("nativeCurrency") as string) ?? baseCurrency)
      .trim()
      .toUpperCase();

    // Price source follows from class. externalId: Advanced override > picked
    // selection > null (server resolves).
    let priceSource: AddAssetInput["priceSource"];
    let externalId: string | null = advExternalId ?? picked?.externalId ?? null;
    if (assetClass === "equity" || assetClass === "etf") {
      priceSource = "finnhub";
    } else if (assetClass === "crypto") {
      priceSource = "coingecko";
    } else {
      priceSource = "manual";
      externalId = null;
    }

    const input: AddAssetInput = {
      name: name || "Unnamed asset",
      symbol,
      assetClass,
      nativeCurrency,
      externalId,
      priceSource,
      quantity,
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

      <SheetContent side="right" className="w-full sm:max-w-[440px] flex flex-col gap-0 p-0">
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
            <div className="grid grid-cols-4 gap-1.5">
              {CLASSES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAssetClass(c.id)}
                  className={cn(
                    "h-10 rounded-lg text-sm font-semibold transition-colors border",
                    assetClass === c.id
                      ? "bg-gold text-primary-foreground border-gold"
                      : "bg-surface text-text-secondary border-border hover:bg-surface-hover",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              {CLASSES.find((c) => c.id === assetClass)?.hint}
            </p>
          </div>

          {/* Symbol / ticker with typeahead */}
          {assetClass !== "cash" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
                Search
              </Label>
              <SymbolAutocomplete
                assetClass={assetClass}
                onChange={(selection, raw) => {
                  setPicked(selection);
                  setRawSymbol(raw);
                }}
                placeholder={
                  assetClass === "crypto"
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

          {/* Cash account name */}
          {assetClass === "cash" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
                Account name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Chase checking · HSBC savings"
                required
                autoFocus
                className="h-11"
              />
            </div>
          )}

          {/* Quantity / balance */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity" className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              {assetClass === "cash" ? "Balance" : "Quantity"}
            </Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="any"
              min="0"
              placeholder={assetClass === "cash" ? "12000" : "100"}
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
            <Input
              id="nativeCurrency"
              name="nativeCurrency"
              defaultValue={
                assetClass === "crypto" ? "USD" : baseCurrency
              }
              placeholder="USD"
              maxLength={3}
              required
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-28"
            />
            <p className="text-xs text-text-muted">
              ISO code. {assetClass === "equity" || assetClass === "etf"
                ? "For LSE stocks use GBP, HKEX use HKD, etc."
                : "For crypto this is the quote currency (usually USD)."}
            </p>
          </div>

          {/* Advanced: CoinGecko slug */}
          {assetClass === "crypto" && (
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
