# Phase 4 Plan: Orders end to end (MVP complete)

Status: Draft for founder confirmation (2026-10-10). This phase runs the live money
flow (authorize, capture, void, refund with splits), so per CLAUDE.md section 5.5
the money-affecting semantics in section 3 are implemented as the documented design,
kept configurable, and flagged for confirmation. Nothing is hard-decided.
Source: docs/07 (orders and workflows), docs/06 (payments and splits), docs/08
(dispatch), docs/15 Phase 4 acceptance, docs/25 (stops B1, payment plans B2), the
reference schema (migrations 0008 dispatch, 0009 orders, 0010 payments), the
PaymentGateway interface in packages/integrations/src/payment-gateway.ts, and the
Phase 3 money engines (fare, fees, surge, splits, gateway) already shipped.

## 1. Goal

A customer can get an estimate, place an order, have a provider dispatched, be
authorized with splits on assignment, move through workflow stages with proof and
live tracking, be captured at completion with the splits settling in Moyasar, and
then rate. Cancellations (void or partial capture), refunds and disputes work.
The same engine runs towing, trucking, courier and an AC maintenance check by
configuration only. Acceptance (docs/15): a full towing order in the Moyasar
sandbox on staging, splits verified in the Moyasar dashboard, from the web
(storefront plus provider PWA) and from both native apps.

## 2. Scope and staging

Phase 4 is the largest phase. It is built backend first so every client surface
consumes one proven API, then the web surfaces, then the native apps. Each numbered
item in the build sequence (section 4) is one reviewable increment with its own
contracts, tests and docs.

### In scope

- Domain engines (pure, no IO, property and branch tested) in `packages/domain`:
  - `orders/workflow.ts`: the state machine. Given the order's workflow (stages
    with `maps_to`, `actor`, `requires`, `payment_action`, `tracking_active`,
    `sla_minutes`) and the current stage, decide the allowed transitions, validate
    the proof presented, and return the resolved side effects (payment action to
    run, tracking start or stop, SLA timer, notifications to emit). Core statuses
    per docs/07 section 1. Ops force transitions carry a reason.
  - `orders/cancellation.ts`: given the moment (before assignment, within free
    minutes, after free minutes, after arrival, provider cancels) and the rate
    card cancellation policy, return the outcome (free, void, partial capture of
    the cancellation fee, or minimum fare) and the amount.
  - `orders/reprice.ts`: compute the final price at completion from actual distance
    and duration when metered or when the deviation exceeds the rate card
    `reprice_threshold_pct`, clamped to the authorized amount plus buffer.
  - `dispatch/scoring.ts`: rank candidate agents for `auto_nearest` (distance from
    Redis GEO, rating, reliability, acceptance rate), and the `broadcast`,
    `manual` and `customer_choice` selection rules; offer rounds and timeout.
- Orders API module (`apps/api/src/orders`): create an order from a valid, unexpired
  estimate (tokenized card reference, fields, add-ons, stops); read an order and its
  stops, events and media; advance a stage with proof (agent, customer, ops, system
  actors, server-side proof validation); ops force transition with an audited reason;
  cancel. Every transition writes `order_events` and emits `order.stage_changed` via
  the outbox. Orders keep the workflow version used at creation.
- Payments module (`apps/api/src/payments`): authorize on assignment with the splits
  from the Phase 3 allocator, capture at the completion stage (final price), void
  when nothing is owed, partial capture for a cancellation fee, refund (full and
  partial); the auth-expiry guard worker; the Moyasar payment webhook (verified,
  exactly once via `webhook_events`); the daily reconciliation job comparing our
  ledger with the gateway. Every external call is idempotent (idempotency keys).
- Dispatch module (`apps/api/src/dispatch` plus a worker): create offers, run rounds
  (BullMQ), accept or decline, re-dispatch on timeout or provider cancel; presence
  from Redis GEO. Realtime offer delivery to the provider.
- Tracking: the provider app streams positions to `apps/realtime`; hot state in Redis
  GEO; batched persistence to partitioned `tracking_points`; the customer subscribes
  to the order room only while a stage has `tracking_active`.
- Web storefront ordering (`apps/web-storefront`, MVP): estimate, pay with the
  Moyasar hosted form or Apple Pay on the web, live tracking, order history, ratings;
  the customer My account portal. Provider PWA (`apps/provider-app` Expo web): go
  online, receive offers, navigate, run stages, upload proof, see earnings.
- Ops live map (`apps/web-console`): active orders, provider positions, SLA alerts,
  manual dispatch and force transitions.
- Disputes and ratings: open a dispute with auto-collected evidence (stages, photos,
  OTP logs, GPS trail); ops resolves with refund, partial refund or no action;
  two-way ratings after completion feeding dispatch scoring.
- Native apps (`apps/customer-app`, `apps/provider-app`) for towing: request, price,
  pay, track, rate; go online, offers, navigation, stages, proof, earnings. This is a
  large sub-track taken last, after the web surfaces prove the API.

### Out of scope (later phases)

- Notification provider credentials and WebSocket scale-out hardening (Phase 5); the
  pipeline is built here with the console or log provider.
- Public API platform keys, OAuth and webhook subscriptions (Phase 6).
- Licence billing, memberships, custom domains and branded app builds (Phase 7).
- Passenger transport (docs/25 section 6, later, regulation gated).
- Real Moyasar fee-matrix values and production capture (behind the payments flag
  until the sandbox flow is proven on staging).

## 3. Business-sensitive decisions (need founder confirmation, CLAUDE.md 5.5)

Implemented as the documented design (docs/06, docs/07), kept configurable.

1. Authorize timing (Q3): authorize when the provider is assigned, with the provider
   named in the splits; capture at the completion stage. A seam remains for
   capture-time splits if Moyasar confirms they can be set at capture.
2. Capture amount: the final price from `orders/reprice.ts`, never more than the
   authorized amount (estimate plus buffer). If the final price exceeds the
   authorization, a supplement payment is requested, not an over-capture.
3. Cancellation (docs/07 section 6): before assignment free (no auth or void); within
   free minutes void (reverses all splits); after free minutes a cancellation fee via
   partial capture, split per the fee schedule (part to the provider for the wasted
   trip); after arrival a higher fee or the minimum fare; provider cancel is free to
   the customer and re-dispatches.
4. Refunds: full or partial, only against captured amounts, respecting each split's
   `refundable` flag; a refund never leaves a split negative.
5. Auth expiry: a guard worker voids or re-authorizes before Moyasar's authorization
   window lapses; the window is read from the payment `auth_expires_at`.
6. We never hold funds: money flows Moyasar to each recipient via Split Payments; no
   wallets or balances. Card data never touches our servers (hosted form, SDK,
   tokenization).

## 4. Build sequence

1. Order and dispatch domain engines (workflow state machine, cancellation, reprice,
   dispatch scoring) with property and branch tests; the workflow reproduces the
   docs/07 towing stages exactly.
2. Orders API: create from estimate, read, advance stage with proof, cancel, ops
   force transition; order_events and outbox; RLS and the isolation suite; e2e for
   the stage lifecycle (no live capture yet, payment actions behind the flag).
3. Payments: authorize, capture, void, partial capture, refund with splits; the
   webhook (exactly once); the auth-expiry guard and reconciliation workers;
   property tests that splits always balance and capture never exceeds authorization;
   a sandbox e2e that authorizes and captures a towing order and verifies the splits.
4. Dispatch: offers, rounds, accept and decline, re-dispatch; the auto-dispatch
   worker; presence from Redis GEO; realtime offer delivery.
5. Tracking: provider position stream, Redis GEO hot state, batched persistence,
   customer subscription gated by `tracking_active`.
6. Web storefront ordering and the provider PWA (the acceptance surface for the web).
7. Ops live map, disputes, ratings, receipts, chargeback evidence pack, Apple Pay
   domain registration per tenant domain.
8. Native customer and provider apps for towing.

## 5. Risks and mitigations

- Money correctness: all math in bigint minor units through the Phase 3 engines;
  every gateway call idempotent; property tests assert splits balance and capture is
  bounded by authorization; the webhook is verified and processed exactly once; the
  reconciliation job catches drift daily.
- Authorization expiry on long jobs (trucking): payment milestones (docs/25 B2) and
  the auth-expiry guard; kept pluggable so multi day flows fit without a refactor.
- State machine correctness: the engine is pure and exhaustively branch tested;
  illegal transitions are rejected; ops overrides are audited.
- Dispatch fairness and races: offers are idempotent per round; exactly one
  acceptance wins via an atomic conditional write; timeouts re-dispatch.
- Scope: backend first (increments 1 to 5) unblocks all clients; the web surfaces
  prove the API before the large native app track (increment 8).

## 6. Acceptance tests

- The docs/07 towing workflow runs end to end: estimate, order, dispatch, authorize
  with splits, stages with proof and tracking, capture at completion, rate.
- Splits always balance and capture never exceeds the authorized amount (property and
  example tests); the docs/06 worked example settles exactly.
- Cancellation before assignment is free; after free minutes takes the fee via
  partial capture; a provider cancel re-dispatches with no customer fee.
- RLS isolation holds for every new table and endpoint; the webhook is exactly once;
  the auth-expiry guard and reconciliation jobs run.
- On staging: a full towing order in the Moyasar sandbox from the web (storefront plus
  provider PWA) and from both native apps, with splits verified in the Moyasar
  dashboard; trucking and courier launched by configuration only.
