---
title: Shipping 0-to-1 in regulated markets
description: Notes from launching a prediction market platform in under two months.
date: 2026-04-10
---

In 2024 I helped launch a new prediction market platform at Crypto.com. Two months
from concept to live. 200+ people across engineering, product, compliance, legal,
risk, and external partners. CFTC regulatory oversight the entire way.

A few things I'd tell anyone doing something similar:

### 1. Decide what "done" means before the first sprint

In regulated work, "feature complete" and "shippable" are different things. We
split scope into three buckets early: *launch-critical*, *fast-follow*, and
*maybe-never*. Everything got assigned, and nothing moved buckets without a
documented reason. It killed a lot of late-stage drama.

### 2. The critical path is usually people, not code

Engineering velocity was never the bottleneck. Legal review windows, compliance
sign-off, market-maker onboarding — those were. Map the critical path by
*decision*, not by *ticket*.

### 3. Write down every trade-off

If you made a call and didn't write it down, you'll re-litigate it three weeks
later with less context. Every exec meeting got a one-page summary: what we
decided, what we didn't, and why. Boring but essential.

---

None of this is groundbreaking. But it's what actually moves the needle when
you're trying to land a regulated product on a brutal timeline.
