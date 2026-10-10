# Phase 3 Plan: Pricing and Fees

Status: Draft for founder approval (2026-10-10). This phase touches money and fee
semantics directly, so per CLAUDE.md section 5.5 no money-affecting code lands
until the decisions in section 3 are confirmed.
Source: docs/09 (pricing and fees), docs/06 (payments and splits), docs/16 open
questions Q1, Q2, Q3, Q4, Q14, Q15, the reference schema (migration 0007 pricing,
0010 payments), and the worked examples pinned in packages/domain/src/money/money.test.ts.

## 1. Goal

Make pricing and fees fully configurable and provably correct. Pure engines
compute an estimate, the fee lines with VAT, surge, and the payment splits, all in
integer minor units, reproducing the docs/09 and docs/06 worked examples exactly.
Estimates are stored with a short expiry. A fee and price simulator matches the
engine. Rate cards and fee schedules use maker-checker. The open revenue and VAT
questions stay configurable, nothing is hard-decided (Q1, Q2, Q3, Q14, Q15).

Acceptance (docs/15 Phase 3): property tests for price and fee invariants, splits
always balance, the simulator matches the engine, and the documented worked
examples reproduce exactly.

## 2. Scope

### In scope

- Schema: a new migration adds `price_estimates` (inputs, itemized breakdown as
  jsonb, currency, totals in minor units, the rate-card and fee-schedule versions
  used, `expires_at`) and the deferred `orders.price_estimate_id` foreign key. All
  the other pricing and fee tables already exist (migration 0007).
- Domain engines (pure, no IO, property and branch tested) in `packages/domain`:
  - `pricing/estimate.ts`: `price(input)` implementing the docs/09 section 3 ten
    steps. The API resolves the rate card, zone and surge rows and the routed
    distance and duration from MapsProvider; the engine takes resolved inputs and
    returns an itemized breakdown plus the authorized amount (estimate + buffer).
  - `fees/engine.ts`: apply `fee_components` (percent, fixed, percent_plus_fixed,
    base service_amount/addons/order_total, min and max bounds, vat_mode
    exclusive/inclusive/exempt) to produce fee lines per bearer plus VAT, honoring
    the no-surcharging rule (a customer-borne fee is identical across methods).
  - `pricing/surge.ts`: combine scheduled surge (days, time, date, multiplier) and
    dynamic surge (steps from demand and supply) by max or multiply, capped.
  - `splits/allocate.ts`: from the order total, the fee schedule and the gateway
    fee rate, produce `SplitInput[]` (provider, platform, beneficiary) satisfying
    the docs/06 rules (sum equals amount, zero or one fee source, provider never
    negative, platform may be negative for promo), built on the existing
    `allocateMoney`, `scaleMoney` and `assertSplitsBalance` primitives.
  - `fees/gateway.ts`: estimate the gateway fee from `gateway_fee_rates` (mada cap).
- API module (`apps/api/src/pricing`): a public estimate endpoint (compute and
  store a `price_estimate`, return the breakdown and expiry); rate-card and
  fee-schedule admin CRUD with maker-checker (create draft, a different user
  approves); surge config; and the fee and price simulator. Tenant-scoped, RLS,
  idempotency, problem+json, audit, outbox, guarded by pricing.edit and
  pricing.approve. Contracts and OpenAPI for every endpoint.
- Console: a rate-card editor, a fee-schedule editor with the maker-checker
  approve step, a surge schedule editor, and the fee and price simulator.
  Bilingual, RTL first.
- Tests: property tests (price clamping and rounding, fee plus VAT, splits always
  balance), the two worked examples reproduced exactly, the simulator equals the
  engine, and an estimate e2e in the CI database job.

### Out of scope (later phases)

- Sending the computed splits to the gateway on authorize and capture (Phase 4,
  orders end to end). Phase 3 computes the split array; Phase 4 authorizes and
  captures with it.
- The live demand and supply feed for dynamic surge (Phase 4 and 5). Phase 3
  computes surge from provided demand and supply and persists `surge_snapshots`.
- Membership fee overrides billing (Phase 7). The fee engine already accepts an
  override fee schedule as input.
- Real Moyasar fee-matrix values and live capture (Q1, Q8). `gateway_fee_rates`
  carries sandbox values behind the payments flag.

## 3. Business-sensitive decisions (need founder confirmation, CLAUDE.md 5.5)

These govern money. The semantics below come from docs/09, docs/06 and the seed;
I will implement them as the documented design and keep the open questions
configurable. Please confirm or redirect each before I write money code.

1. Split default: the fee source is the provider (fee_schedule.gateway_fee_bearer,
   seed uses provider), matching the docs/06 worked example (provider 89.02,
   platform 10.00, gateway 0.98 on mada). The engine supports platform too.
2. Revenue model (Q2): build revenue-share now (platform fee components); keep the
   same engine able to express a reseller buy-rate later. Not hard-decided.
3. VAT (Q14): vat_mode is per fee component (exclusive, inclusive, exempt); the
   seed commission is inclusive. No global VAT rule is hard-coded.
4. Split timing (Q3): authorize after assignment with the provider named in the
   splits; leave a seam for capture-time splits. Not hard-decided.
5. Surge for towing (Q15): scheduled only, low caps, mandatory customer
   acknowledgement before confirming. Dynamic surge is built but off for towing.
6. Defaults: fare rounding per rate_card.rounding; estimate expiry 5 minutes;
   reprice threshold 20 percent; authorization buffer from rate_card.auth_buffer_pct
   (seed 15 percent).
7. Maker-checker: the creator cannot approve a rate card or fee schedule; mandatory
   above a configurable threshold, optional for small tenants via a setting.

## 4. Build sequence

1. Schema (`price_estimates` plus the FK), contracts, and the pure engines (price,
   fee, surge, split, gateway fee) with property tests reproducing the worked
   examples.
2. Estimate and simulator API.
3. Rate-card and fee-schedule admin with maker-checker, and surge config.
4. Console editors and the simulator.
5. Estimate e2e.

## 5. Risks and mitigations

- Money correctness: all math in bigint minor units through the existing
  primitives, no floats in the hot path; property tests assert splits always
  balance and the worked examples reproduce exactly.
- Open questions stay configurable (Q1, Q2, Q3, Q14, Q15); nothing is hard-decided.
- No surcharging: enforced by the fee_components CHECK and the engine.
- Maker-checker: enforced by the DB CHECK (approver not creator) and the API.

## 6. Acceptance tests

- The docs/09 towing example yields 264.00 SAR and authorizes 304.00 SAR; the
  docs/06 split example yields provider 89.02, platform 10.00, gateway 0.98
  (fee source provider, mada), exactly, in example and property tests.
- An estimate is stored with an expiry; the simulator output equals the engine.
- Splits always balance (property test); RLS and maker-checker are enforced; the
  estimate e2e passes in CI.
