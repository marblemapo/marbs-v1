"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPrice } from "@/lib/prices";

type AssetClass = "equity" | "etf" | "crypto" | "cash";
type PriceSource = "yahoo" | "coingecko" | "manual";

export type AddAssetInput = {
  name: string;
  symbol: string | null;
  assetClass: AssetClass;
  nativeCurrency: string;
  externalId: string | null;
  priceSource: PriceSource;
  quantity: number;
};

export type AddAssetResult =
  | { ok: true; assetId: string }
  | { ok: false; error: string };

/**
 * Creates an asset, seeds the initial balance_snapshots row with the user's
 * quantity, and caches the current price if the provider returns one.
 *
 * Idempotency: we don't dedupe by (user, symbol) — users can have e.g. two
 * separate "USD cash" accounts. Callers are responsible for avoiding dupes.
 *
 * RLS: inserts go through the user's session, so asset.user_id must match
 * auth.uid() (our RLS policy requires it).
 */
export async function addAsset(
  input: AddAssetInput,
): Promise<AddAssetResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Validate basics server-side — never trust client input.
  if (!input.name.trim()) return { ok: false, error: "Name is required" };
  if (!(input.quantity > 0))
    return { ok: false, error: "Quantity must be greater than zero" };
  if (!/^[A-Z]{3}$/i.test(input.nativeCurrency))
    return { ok: false, error: "Currency must be a 3-letter ISO code" };

  const nativeCurrency = input.nativeCurrency.toUpperCase();

  // 1. Insert the asset.
  const { data: asset, error: assetErr } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      symbol: input.symbol?.trim().toUpperCase() ?? null,
      asset_class: input.assetClass,
      native_currency: nativeCurrency,
      price_source: input.priceSource,
      external_id: input.externalId?.trim() || null,
    })
    .select("id")
    .single();

  if (assetErr || !asset)
    return { ok: false, error: assetErr?.message ?? "Failed to create asset" };

  // 2. Seed the first balance snapshot.
  const { error: snapErr } = await supabase.from("balance_snapshots").insert({
    asset_id: asset.id,
    quantity: input.quantity,
    source: "manual",
  });

  if (snapErr) {
    // Best-effort cleanup — orphan assets without balance are still harmless.
    return { ok: false, error: `Asset created but snapshot failed: ${snapErr.message}` };
  }

  // 3. Fire-and-forget: cache the current price via service role (price_cache
  //    is public-read / service-role-write). Doesn't block the user.
  if (input.externalId && input.priceSource !== "manual") {
    const externalId = input.externalId;
    const priceSource = input.priceSource;
    fetchPrice(priceSource, externalId, nativeCurrency)
      .then(async (quote) => {
        if (!quote) return;
        const admin = createAdminClient();
        await admin.from("price_cache").upsert(
          {
            external_id: externalId,
            source: priceSource,
            price_native: quote.price,
            currency: quote.currency,
            fetched_at: quote.asOf,
          },
          { onConflict: "external_id,source" },
        );
      })
      .catch(() => void 0);
  }

  revalidatePath("/dashboard");
  return { ok: true, assetId: asset.id };
}
