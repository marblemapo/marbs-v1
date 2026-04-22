# marbs-v1

A single Next.js app that serves two sites from one codebase:

- **[marbs.io](https://marbs.io)** — Marble's personal site.
- **[wealth.marbs.io](https://wealth.marbs.io)** — **Wealth**, a privacy-first multi-asset net-worth tracker.

`src/app/page.tsx` picks the right landing component based on the request host (wealth subdomain → `WealthLanding`, apex → `PersonalHome`). Icons, OG image, and magic-link branding follow the same split.

The rest of this README is about **Wealth**, since that's where the product surface lives.

---

## Wealth

Privacy-first multi-asset net-worth tracker. Manual entry, live prices, no bank logins.

One dashboard for everything you own — stocks, ETFs, crypto, cash across any currency — without handing over bank credentials. You log what you hold, we fetch live prices, you get a single number.

Built for tech workers who are multi-asset, internationally mobile, and allergic to Plaid.

### Principles

- **Manual entry, not bank logins.** You paste quantities; we don't scrape accounts. Cleaner privacy story, cleaner codebase.
- **Live prices.** Yahoo + Finnhub for equities/ETFs, CoinGecko for crypto, ECB for FX. Cached 10 min; ticks update on dashboard refresh.
- **Base-currency agnostic.** Pick USD, EUR, HKD, anything ISO 4217. Non-base positions convert at current FX.
- **One glance.** Net-worth hero is the headline. Daily delta is paired 1-to-1 (no "partial-previous" distortion).
- **Public-chain, read-only wallets.** Paste an EVM address (or ENS) to auto-sync on-chain balances across six chains. No signing, no custody, no spend paths in code.

### Features

- **Net-worth hero** — big number, live tick, accurate day delta, currency switcher
- **Asset list** — equities, ETFs, crypto, cash; per-row price + value
- **Onboarding wizard** — log ~10 holdings in ~3 minutes, one screen, no multi-step
- **Portfolio assembly animation** — during the final save, particles stream from Stocks / Crypto / Cash arms into a pulsing aqua orb ("gathering your net worth")
- **Wallet sync** — paste any EVM address or ENS name; we read balances across **Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain** and dedupe cross-chain tokens by CoinGecko slug (USDT on ETH + BSC → one "USDT" row)
- **Multi-wallet** — connect any number of wallets in one dialog, each with an optional label
- **Goals + milestones** — schema ready, UI partial
- **Magic-link auth** — Supabase OTP, no passwords, custom-branded email via Resend
- **Hard delete** — nuke your account and every row it touched in one click (cascades through every FK)

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2 (Turbopack) + React 19.2 |
| Language | TypeScript 5, strict |
| Styling | Tailwind v4, shadcn/ui, `@base-ui/react` |
| DB + auth | Supabase (Postgres 15+, RLS, magic-link auth) |
| Transactional email | Resend (custom SMTP plugged into Supabase) |
| Hosting | Vercel |
| Price data | Finnhub (equities) · Yahoo Finance (fallback + FX) · CoinGecko (crypto) · ECB (FX) |
| On-chain | [viem](https://viem.sh) for ENS · Alchemy for balance reads across 6 EVM chains |
| Fonts | Space Grotesk (display, tabular-nums) + Inter (body) + Geist Mono (code) |

## Project structure

```
src/
  app/
    page.tsx           host-split landing (marbs.io personal | wealth.marbs.io Wealth)
    dashboard/         Wealth dashboard — net worth hero, asset list, wallets, delete
    onboarding/        Wealth first-time wizard
    login/             magic-link sign-in
    auth/callback/     Supabase OAuth/OTP return
    notebook/          Marble's blog posts
    actions/           server actions: assets, wallets, account, profile
    api/               search, newsletter subscribe, auth
    icons/, apple-icons/, opengraph-image.tsx   per-host branded PNGs
  components/
    personal-home.tsx            marbs.io landing
    wealth-landing.tsx           wealth.marbs.io landing
    networth-hero.tsx            the big number
    assets-list.tsx, add-asset-drawer.tsx, edit-asset-drawer.tsx
    connected-wallets-section.tsx, connect-wallet-dialog.tsx
    onboarding-wizard.tsx, portfolio-assembly.tsx
    empty-holdings-card.tsx, danger-zone.tsx, delete-account-dialog.tsx
    currency-select.tsx, currency-flag.tsx, currency-context.tsx
    symbol-autocomplete.tsx
    ui/                          shadcn primitives
    f3/                          design-system motion primitives
  lib/
    supabase/                    server/client/admin helpers
    prices.ts                    Finnhub/Yahoo/CoinGecko fetchers
    fx.ts                        FX conversion + ECB rates
    alchemy.ts, ethereum.ts, eth-tokens.ts   on-chain reads + slug cache
    crypto-slugs.ts              ticker → CoinGecko slug
    currencies.ts                ISO 4217 table
supabase/
  migrations/                    initial schema, wallet tables, cash rename, etc.
  email-templates/magic-link.html
DESIGN.md                        Wealth design system: typography, color, motion
AGENTS.md                        agent-mode guardrails
```

## Getting started

Requires Node 20+, pnpm, and a Supabase project.

```bash
git clone https://github.com/marblemapo/marbs-v1
cd marbs-v1
pnpm install
cp .env.example .env.local   # fill the values (see below)
pnpm dev
```

Visit `http://localhost:3000` for the personal site, or `http://localhost:3000/?host=wealth` to preview the Wealth landing locally (the query param bypasses the host check).

### Environment variables

```bash
# Supabase — dashboard → Project → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
SUPABASE_SERVICE_ROLE_KEY=sb_secret_…    # server-only; bypasses RLS for admin tasks

# Finnhub — free tier at finnhub.io (60 req/min)
FINNHUB_API_KEY=…

# Alchemy — free tier at alchemy.com (300M CU/mo across all chains)
# Enable: Ethereum mainnet, Base, Arbitrum, Optimism, Polygon, BNB Smart Chain
ALCHEMY_API_KEY=…
```

### Database

Apply migrations from `supabase/migrations/` in order via the Supabase SQL editor or CLI:

- `20260416000001_initial_schema.sql` — profiles, assets, transactions, balance_snapshots, goals, milestones, price_cache, fx_rates + RLS
- `20260416000002_signup_display_name.sql`
- `20260416000003_balance_rename.sql` — `balance_native` → `quantity`
- `20260419000001_newsletter_subscribers.sql`
- `20260419000001_price_previous.sql` — adds `price_cache.previous_native` for daily delta
- `20260421000001_connected_wallets.sql` — wallet tables, token slug cache, RLS
- `20260421000002_multi_chain_wallets.sql` — enum values for Base/ARB/OP/Polygon/BSC; wallet key drops the chain column

### Transactional email (Supabase → Resend)

Supabase's built-in SMTP has aggressive rate limits — switch to Resend for anything beyond smoke testing:

1. Verify your sender domain on Resend. Add the DKIM + SPF + MX records at your DNS host (Cloudflare etc) with **Proxy status "DNS only"**.
2. Supabase → Authentication → Email → Custom SMTP:
   - Host `smtp.resend.com`, Port `465`, Username `resend`, Password `<Resend API key>`
   - Sender email on your verified domain (e.g. `noreply@marbs.io`), Sender name `Wealth`
3. Paste [`supabase/email-templates/magic-link.html`](supabase/email-templates/magic-link.html) into Supabase → Authentication → Email Templates → Magic Link. The in-repo file is source-of-truth; the live template has to be synced manually.

## Design system

See [`DESIGN.md`](DESIGN.md). Short version:

- Warm dark, minimal, data-forward
- Accent: aqua `#7FFFD4` (live), gold `#f5c518` (on-brand)
- Semantic: gain `#00C805`, loss `#FF5000`
- Space Grotesk for display/numbers (tabular-nums), Inter for body, Geist Mono for code
- Motion language: `pulse-live` on the net-worth dot, tick-flash on value change, portfolio-assembly orbit on first save

## Deployment

Pushes to `main` auto-deploy to production via Vercel. Vercel serves both `marbs.io` (apex) and `wealth.marbs.io` (subdomain) from the same deployment — the app resolves the variant per request at `src/app/page.tsx`. PRs get preview deployments; toggle off Vercel Deployment Protection in project settings if you want anonymous reviewers.

Don't forget the two manual steps a fresh deploy doesn't cover:

1. Apply any new Supabase migrations in order.
2. Sync the magic-link email template in Supabase if it changed.

## Conventions

- Server actions live under `src/app/actions/`. Return `{ ok: true, … } | { ok: false, error }` — the client UI surfaces `error` directly.
- Supabase: `createClient()` for per-user RLS-scoped reads/writes; `createAdminClient()` for service-role writes to shared caches (`price_cache`, `fx_rates`, `token_slug_cache`). Never use the admin client for per-user data.
- Row components in the onboarding wizard live at module scope (not inside the parent) — redefining them per render remounts inputs and kills focus.
- All user tables cascade delete from `auth.users` → `profiles` → everything else. A single `auth.admin.deleteUser` wipes the tree.
- This is Next.js 16. APIs + conventions may have shifted from your training data — see [`AGENTS.md`](AGENTS.md).

## License

Private project, no license granted.
