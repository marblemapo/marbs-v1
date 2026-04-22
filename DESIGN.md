# Design System — Marbs

## Product Context
- **What this is:** Privacy-first multi-asset net-worth tracker. Manual entry, live prices, no bank logins.
- **Who it's for:** Tech workers, mid-to-high income, multi-asset, internationally mobile
- **Space/industry:** Personal finance, privacy-first fintech
- **Project type:** Web app (dashboard)

## Aesthetic Direction
- **Direction:** Warm dark, minimal, data-forward
- **Decoration level:** Minimal — typography and data do the work
- **Mood:** Calm confidence. Like checking a premium watch, not a trading terminal.
- **Reference sites:** marbs.io (identity)

## Typography
- **Display/Hero:** Space Grotesk 700 — net-worth number, section titles, stat values
- **Body:** Inter 400/500/600 — labels, descriptions, nav links, body text
- **Data/Tables:** Space Grotesk 700 with tabular-nums — all financial numbers
- **Code:** Geist Mono
- **Loading:** Google Fonts (Space Grotesk + Inter)
- **Scale:** 10 / 11 / 12 / 13 / 14 / 16 / 18 / 22 / 28 / 32 / 36 / 48 / 64px

## Color
- **Approach:** Restrained — one accent, semantic green/red, warm darks
- **Background:** #1C1C1E
- **Surface:** #2C2C2E
- **Surface hover:** #3A3A3C
- **Primary text:** #FFFFFF
- **Secondary text:** #EBEBF5
- **Muted text:** #8E8E93
- **Accent (gold):** #f5c518
- **Accent dim:** rgba(245, 197, 24, 0.12)
- **Gain:** #00C805
- **Loss:** #FF5000
- **Border:** rgba(255, 255, 255, 0.08)
- **Border strong:** rgba(255, 255, 255, 0.12)
- **Dark mode:** Primary (this IS the dark mode)
- **Light mode:** Deferred

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** 4 / 8 / 12 / 16 / 20 / 24 / 28 / 32 / 36 / 48 / 64px

## Layout
- **Approach:** Hybrid — single-column scroll with split cards for hero
- **Hero component:** Net-worth card: big number + daily change + allocation sparkline
- **Max content width:** 720px
- **Border radius:** sm: 8px, md: 12px, lg: 16px, pill: 100px

## Motion
- **Approach:** Intentional — live data ticking, subtle pulses
- **Easing:** ease-out for entries, ease-in-out for state changes
- **Duration:** tick flash: 0.4s, transitions: 0.15-0.3s
- **Live indicator:** Green dot with 2s pulse animation (opacity + box-shadow)
- **Price tick:** Color flash (green up / red down) on value change, 0.4s ease-out

## Key Components (v2 scope)
- **Net-worth hero:** Large total (48–64px Space Grotesk 700, tabular-nums) + daily change badge + mini allocation bar. One number. One glance.
- **Live indicator pill:** Green pulse dot + "Live" text, accent-dim bg. Only shown when Finnhub WebSocket is connected.
- **Asset row:** Logo/ticker icon, symbol + name stacked left, sparkline middle, value + change right. Tap → detail.
- **Allocation chart:** Horizontal stacked bar, one row per asset class, percentage labels.
- **Category pills:** Horizontal scroll, border pills, active = filled white.
- **Milestone badge:** Pill shape, accent-dim bg, gold text, dot indicator, uppercase.
- **CTA button:** Aqua green, pill shape, full-width on forms, 700 weight.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-04 | Space Grotesk + Inter | Matches existing marbs.io fonts |
| 2026-04-04 | Dense-list layout | Pills, dense data rows, warm dark bg — retail brokerage ergonomics |
| 2026-04-04 | Keep #f5c518 gold | Bright gold over refined #D4A843 |
| 2026-04-04 | No serif fonts | SF/system sans preferred |
| 2026-04-16 | Scope pivot v2 | From FIRE countdown to net-worth tracker. FIRE badge demoted to optional lens; net-worth hero is the new centerpiece. Ring component retired in v2 hero. |
