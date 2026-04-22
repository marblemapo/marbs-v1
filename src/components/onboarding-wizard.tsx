"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { SymbolAutocomplete } from "@/components/symbol-autocomplete";
import { CurrencySelect } from "@/components/currency-select";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { addAsset, type AddAssetInput } from "@/app/actions/assets";
import { getCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/app/api/search/route";

type StockRow = {
  id: string;
  picked: SearchResult | null;
  rawSymbol: string;
  quantity: string;
};

type CryptoRow = StockRow;

type CashRow = {
  id: string;
  currency: string;
  balance: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blankStock(): StockRow {
  return { id: uid(), picked: null, rawSymbol: "", quantity: "" };
}
function blankCash(defaultCurrency: string): CashRow {
  return { id: uid(), currency: defaultCurrency, balance: "" };
}

// --- Row components live at module scope ---
// Critical: these MUST be declared outside the parent. If defined inside
// OnboardingWizard, every parent re-render creates a new component
// reference → React unmounts and remounts the whole row → inputs lose
// focus on every keystroke → user can't type anything. Hours of puzzled
// smoke-test debugging lie this way.

function StockLikeRow({
  row,
  uiClass,
  onPatch,
  onRemove,
  canRemove,
}: {
  row: StockRow;
  uiClass: "stock" | "crypto";
  onPatch: (id: string, patch: Partial<StockRow>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <SymbolAutocomplete
          assetClass={uiClass}
          placeholder={
            uiClass === "crypto"
              ? "Type to search — btc, eth, solana…"
              : "Type to search — tesla, apple, 0700…"
          }
          onChange={(sel, raw) =>
            onPatch(row.id, { picked: sel, rawSymbol: raw })
          }
        />
      </div>
      <Input
        type="number"
        step="any"
        min="0"
        placeholder="qty"
        value={row.quantity}
        onChange={(e) => onPatch(row.id, { quantity: e.target.value })}
        inputMode="decimal"
        className="h-11 w-28 tabular-nums"
      />
      <button
        type="button"
        onClick={() => onRemove(row.id)}
        disabled={!canRemove}
        aria-label="Remove row"
        className="h-11 w-9 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
      >
        ×
      </button>
    </div>
  );
}

function CashRowUI({
  row,
  onPatch,
  onRemove,
  canRemove,
}: {
  row: CashRow;
  onPatch: (id: string, patch: Partial<CashRow>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-32 shrink-0">
        <CurrencySelect
          defaultValue={row.currency}
          placeholder="USD"
          onValueChange={(v) =>
            onPatch(row.id, { currency: v.trim().toUpperCase() })
          }
        />
      </div>
      <Input
        type="number"
        step="any"
        min="0"
        placeholder="balance"
        value={row.balance}
        onChange={(e) => onPatch(row.id, { balance: e.target.value })}
        inputMode="decimal"
        className="h-11 flex-1 tabular-nums"
      />
      <button
        type="button"
        onClick={() => onRemove(row.id)}
        disabled={!canRemove}
        aria-label="Remove row"
        className="h-11 w-9 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
      >
        ×
      </button>
    </div>
  );
}

/**
 * First-time onboarding — a single-screen grid so users can log ~10 holdings
 * in under 3 minutes. No multi-step wizard; just sections for Stocks/ETFs,
 * Crypto, Cash, with repeatable rows per section.
 *
 * On Finish we fire every row through the existing addAsset server action
 * in parallel. Succeeded rows land in the DB; any that fail show an error
 * list at the bottom and are NOT removed from the form so the user can fix
 * and retry.
 */
export function OnboardingWizard({
  displayName,
  baseCurrency,
}: {
  displayName: string;
  baseCurrency: string;
}) {
  const router = useRouter();
  const [stocks, setStocks] = useState<StockRow[]>([blankStock()]);
  const [crypto, setCrypto] = useState<CryptoRow[]>([blankStock()]);
  const [cash, setCash] = useState<CashRow[]>([blankCash(baseCurrency)]);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<
    { label: string; message: string }[]
  >([]);
  const [walletOpen, setWalletOpen] = useState(false);

  // ---------- Row helpers ----------
  const patchStocks = (id: string, patch: Partial<StockRow>) =>
    setStocks((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const patchCrypto = (id: string, patch: Partial<CryptoRow>) =>
    setCrypto((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const patchCash = (id: string, patch: Partial<CashRow>) =>
    setCash((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // ---------- Completion counts ----------
  const stockReady = stocks.filter(
    (r) => (r.picked || r.rawSymbol) && Number(r.quantity) > 0,
  );
  const cryptoReady = crypto.filter(
    (r) => (r.picked || r.rawSymbol) && Number(r.quantity) > 0,
  );
  const cashReady = cash.filter(
    (r) => r.currency && Number(r.balance) > 0,
  );
  const totalReady =
    stockReady.length + cryptoReady.length + cashReady.length;

  // ---------- Submit ----------
  async function handleFinish() {
    setErrors([]);
    if (totalReady === 0) return;

    // Build AddAssetInput list + parallel identifier labels for error surfacing.
    const inputs: AddAssetInput[] = [];
    const labels: string[] = [];

    for (const r of stockReady) {
      const symbol =
        (r.picked?.symbol ?? r.rawSymbol).trim().toUpperCase() || null;
      inputs.push({
        name: r.picked?.name || symbol || "Unnamed",
        symbol,
        // Finnhub search tells us whether it's an ETF or equity; default
        // equity for free-typed symbols.
        assetClass: r.picked?.assetClass === "etf" ? "etf" : "equity",
        nativeCurrency: baseCurrency, // server will prefer quote.currency
        externalId: r.picked?.externalId ?? null,
        priceSource: "finnhub",
        quantity: Number(r.quantity),
        logo: r.picked?.thumb ?? null,
      });
      labels.push(symbol ?? "stock");
    }

    for (const r of cryptoReady) {
      const symbol =
        (r.picked?.symbol ?? r.rawSymbol).trim().toUpperCase() || null;
      inputs.push({
        name: r.picked?.name || symbol || "Unnamed",
        symbol,
        assetClass: "crypto",
        nativeCurrency: "USD",
        externalId: r.picked?.externalId ?? null,
        priceSource: "coingecko",
        quantity: Number(r.quantity),
        logo: r.picked?.thumb ?? null,
      });
      labels.push(symbol ?? "crypto");
    }

    for (const r of cashReady) {
      const info = getCurrency(r.currency);
      const code = r.currency.toUpperCase();
      inputs.push({
        name: info?.name ?? code,
        symbol: code,
        assetClass: "cash",
        nativeCurrency: code,
        externalId: null,
        priceSource: "manual",
        quantity: Number(r.balance),
      });
      labels.push(`${code} cash`);
    }

    startTransition(async () => {
      // Fire all in parallel. Finnhub free tier = 60 rpm which comfortably
      // covers ~10 rows. CoinGecko is generous for crypto.
      const results = await Promise.all(inputs.map((i) => addAsset(i)));
      const failed = results
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => !r.ok)
        .map(({ r, i }) => ({
          label: labels[i],
          message: r.ok ? "" : r.error,
        }));

      if (failed.length === 0) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setErrors(failed);
      // Don't navigate — leave the user on the wizard to fix the failures.
    });
  }

  return (
    <main className="f3-stage flex-1">
      <div className="mx-auto w-full max-w-[780px] px-6 flex flex-col gap-10 py-14 f3-fade-in">
        {/* Header */}
        <header className="flex flex-col gap-3">
          <span className="inline-flex self-start items-center gap-1.5 bg-gold-dim text-gold text-[11px] font-semibold px-2.5 py-1 rounded-pill uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-live" />
            Wealth · onboarding
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-none tracking-tight">
            Welcome, <span className="text-gold">{displayName}</span>
          </h1>
          <p className="text-base leading-relaxed text-text-secondary max-w-[560px]">
            Let&apos;s log your holdings. Add one row per position — stock,
            crypto, or cash account. Should take about three minutes. You can
            always add more later.
          </p>
        </header>

        {/* Wallet — optional shortcut for crypto */}
        <button
          type="button"
          onClick={() => setWalletOpen(true)}
          className="flex flex-col gap-2 p-5 rounded-lg bg-surface border border-gold/20 hover:border-gold/40 transition-colors text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-gold">
              Got on-chain crypto?
            </h2>
            <span className="text-gold text-lg shrink-0">→</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Ethereum",
              "Base",
              "Arbitrum",
              "Optimism",
              "Polygon",
              "BNB Chain",
            ].map((c) => (
              <span
                key={c}
                className="inline-flex items-center h-6 px-2 rounded-pill bg-gold-dim text-gold text-[11px] font-semibold"
              >
                {c}
              </span>
            ))}
          </div>
          <div className="text-sm text-text-secondary leading-relaxed">
            Paste an EVM address or ENS — we&apos;ll auto-import your tokens
            across all six chains. Read-only, no signing, disconnect any time.
          </div>
        </button>

        {/* Stocks & ETFs */}
        <section className="flex flex-col gap-3 p-5 rounded-lg bg-surface border border-border">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold">Stocks & ETFs</h2>
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              {stockReady.length} ready
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {stocks.map((row) => (
              <StockLikeRow
                key={row.id}
                row={row}
                uiClass="stock"
                onPatch={patchStocks}
                onRemove={(id) =>
                  setStocks((s) => s.filter((r) => r.id !== id))
                }
                canRemove={stocks.length > 1}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStocks((s) => [...s, blankStock()])}
            className="self-start text-xs text-gold hover:underline font-semibold"
          >
            + Add another stock
          </button>
        </section>

        {/* Crypto */}
        <section className="flex flex-col gap-3 p-5 rounded-lg bg-surface border border-border">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold">Crypto</h2>
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              {cryptoReady.length} ready
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {crypto.map((row) => (
              <StockLikeRow
                key={row.id}
                row={row}
                uiClass="crypto"
                onPatch={patchCrypto}
                onRemove={(id) =>
                  setCrypto((s) => s.filter((r) => r.id !== id))
                }
                canRemove={crypto.length > 1}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCrypto((s) => [...s, blankStock()])}
            className="self-start text-xs text-gold hover:underline font-semibold"
          >
            + Add another crypto
          </button>
        </section>

        {/* Cash */}
        <section className="flex flex-col gap-3 p-5 rounded-lg bg-surface border border-border">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold">Cash</h2>
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
              {cashReady.length} ready
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {cash.map((row) => (
              <CashRowUI
                key={row.id}
                row={row}
                onPatch={patchCash}
                onRemove={(id) => setCash((s) => s.filter((r) => r.id !== id))}
                canRemove={cash.length > 1}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCash((s) => [...s, blankCash(baseCurrency)])}
            className="self-start text-xs text-gold hover:underline font-semibold"
          >
            + Add another cash account
          </button>
        </section>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="flex flex-col gap-2 p-4 rounded-lg bg-loss/10 border border-loss/20">
            <div className="text-sm font-semibold text-loss">
              Couldn&apos;t add {errors.length} row
              {errors.length === 1 ? "" : "s"}:
            </div>
            <ul className="flex flex-col gap-1 text-xs text-text-secondary">
              {errors.map((e, i) => (
                <li key={i}>
                  <span className="font-semibold">{e.label}</span> —{" "}
                  {e.message}
                </li>
              ))}
            </ul>
            <div className="text-xs text-text-muted mt-1">
              Successful rows were saved. Fix these and click Finish again to
              retry the failures.
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="text-xs text-text-muted hover:text-foreground transition-colors"
          >
            Skip for now
          </Link>
          <button
            type="button"
            onClick={handleFinish}
            disabled={pending || totalReady === 0}
            className={cn(
              "inline-flex items-center gap-2 h-11 px-5 rounded-lg font-semibold text-sm transition-colors",
              "bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed",
              !pending && totalReady > 0 && "hover:bg-primary/80",
            )}
          >
            {pending ? (
              "Saving…"
            ) : (
              <>
                Finish
                <span className="bg-background/20 text-[11px] px-1.5 py-0.5 rounded-pill tabular-nums">
                  {totalReady}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      <ConnectWalletDialog open={walletOpen} onOpenChange={setWalletOpen} />
    </main>
  );
}
