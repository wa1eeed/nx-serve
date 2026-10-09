# ADR-0014: Orders are a list of stops; payment plans generalise authorize and capture

- Status: Accepted
- Date: 2026-10-09

## Context

The validated reference schema (`database/reference-schema.sql`) models an order with a single
`origin` and `destination` and assumes a single authorize then capture money flow. docs/25
(capability blocks) requires the engine to run towing, point to point trucking and courier delivery
as three templates on the same code, and later a passenger transport pack. Trucking and courier
routes have N stops, and long or multi day jobs, business accounts and "buy for me" errands need
money flows beyond a single authorize and capture. Building these as capability blocks now is cheap;
retrofitting them onto a single origin and destination and a single capture later is expensive.

CLAUDE.md requires an ADR when we change the validated reference design.

## Decision

- **Stops model.** Every order owns an ordered list of `order_stops` (sequence, kind of
  pickup/dropoff/service/waypoint, location, masked contact, time window, status, per stop proof,
  OTP and items). A one location job has one stop, towing has two, a route has N. The reference
  schema `orders.origin` and `orders.destination` become derived from the first and last stop and
  are not the source of truth. Proof requirements and workflow stages can be stop aware. Pricing
  sums routed legs; `max_stops` and an extra stop fee are tier settings.
- **Payment plans.** A tier or category selects a payment plan; milestones bind to workflow stages.
  Plans: `authorize_capture` (default), `prepay`, `deposit_then_balance`, `milestones`, `invoice`
  (business accounts), `reimbursable_purchase`, and `cash_on_delivery` (disabled by default, behind
  a setting, pending legal review, docs/16 Q23). Tables `payment_plans` and `payment_milestones`.
- Both sets of tables are created in the Phase 0 migrations so the shape is fixed from the start; the
  order engine behaviour that uses them is built in Phase 4 (docs/15).

## Consequences

- One order engine serves one location, two location and N stop services without vertical specific
  code, and the passenger pack fits later without refactoring.
- `milestones` lets long haul trucking capture value at pickup and delivery, which sidesteps the
  mada authorization hold limit (about 14 days, docs/16 Q4) on multi day trips.
- The splits domain stays gateway agnostic; a milestone capture still produces balanced splits.
- Slightly more schema up front and a derivation rule for `orders.origin` and `orders.destination`.

## Alternatives considered

- Keep single origin and destination and add stops later: a larger migration and data backfill once
  orders exist, and workflow and pricing rewrites. Rejected per "cheap now, expensive later".
- A separate route service: premature; the modular monolith keeps stops inside the orders module
  until extraction is justified (ADR-0001).
