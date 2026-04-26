---
title: Shipping OG from 0-to-1
description: Notes from launching a prediction market platform in under two months.
date: 2026-04-20
---

In 2026 I had the chance to help lead the launch of OG — a new prediction
market platform spun out of Crypto.com as a standalone product. Concept to
live in under two months, with 200+ people across engineering, product,
compliance, legal, risk, ops, and external partners — market makers, the
works. CFTC oversight the entire way.

My role was to help drive delivery end-to-end — shaping the product
alongside eng and design, holding the trade-off conversations, and trying
to keep 200 people moving against the same version of the plan. I'm still
learning from it, but a few things stood out:

### 1. Decide what "done" means before the first sprint

In regulated work, "feature complete" and "shippable" aren't the same. We
tried to split scope into three buckets early: *launch-critical*,
*fast-follow*, and *maybe-never*. Everything got an owner, and we tried not
to move things between buckets without a written reason. When the timeline
got tight — and it did — that doc was what kept scope trade-offs from
turning into politics.

### 2. The critical path is usually people, not code

Engineering velocity rarely seemed to be the bottleneck. Legal review
windows, compliance sign-off, market-maker onboarding, vendor integrations
— those were. I started mapping the critical path less by ticket and more
by *decision*: who needs to say yes, by when, and what do they need to see
to say it. That reframing helped more than I expected.

### 3. Write things down

The trade-off calls were easier when we got everyone to the same version
of the answer and wrote it down. If a decision didn't get captured, it
tended to get re-litigated three weeks later with less context and more
tired people. So we tried to keep a short summary for each: what we
decided, what we deferred, why. Boring, but it helped.

---

A lot of this is stuff I'm still figuring out. But the pattern I keep
coming back to is that what compounds is the operating system underneath —
clear scope, decision velocity, a written record. When that works, a big
effort can move a little more like a small one.
