---
title: Shipping OG from 0-to-1 
description: Notes from launching a prediction market platform in under two months.
date: 2026-04-20
---

In 2026 I'm the project leader for the launch of OG — a new prediction market platform spun
out of Crypto.com as a standalone product. Concept to live in under two months.
200+ people across engineering, product, compliance, legal, risk, ops, and
external partners — data vendors, market makers, the works. CFTC oversight the
entire way.

As project leader, my job was to own delivery end-to-end — shaping the product
alongside eng and design, driving the trade-off calls, and making sure 200
people building in parallel stayed aligned on the same version of the plan.
A few things I took away:

### 1. Decide what "done" means before the first sprint

In regulated work, "feature complete" and "shippable" are different things. We
split scope into three buckets early: *launch-critical*, *fast-follow*, and
*maybe-never*. Everything got assigned an owner, and nothing moved buckets
without a documented reason. When the timeline got tight — and it always does —
that triage doc was what kept real-time scope trade-offs from turning into
politics.

### 2. The critical path is usually people, not code

Engineering velocity was never the bottleneck. Legal review windows, compliance
sign-off, market-maker onboarding, data vendor integrations — those were. I
stopped mapping the critical path by ticket and started mapping it by *decision*:
who needs to say yes, by when, and what do they need to see to say it. That one
reframing bought us weeks.

### 3. Write down every trade-off

I wasn't in the exec room, but I owned the layer underneath it — facilitating
the trade-off calls and making sure the whole team landed on the same version
of the answer. If a decision got made and didn't get written down, it would be
re-litigated three weeks later with less context and more tired people. So
every call got a short summary: what we decided, what we deferred, and why.
Boring, but it's what kept 200 people pulling in the same direction without
the CEO having to repeat himself.

### 4. Build the SOP while you're still bleeding

Post-launch, we had to list 100+ event contracts a week — each touching tech,
data, compliance, and market makers. If we'd waited until "things calmed down"
to codify the process, we'd still be firefighting. We wrote the SOP the same
week we shipped. Scaling to a 40x surge in weekly trading activity was only
possible because the playbook already existed.

---

None of this is groundbreaking. But on a brutal timeline under a regulator,
boring operational discipline is what actually moves the needle.
