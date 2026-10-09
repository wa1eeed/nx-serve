# 25. Capability Blocks and Vertical Templates (towing, trucks, couriers and beyond)

## 1. Principle

The engine supports any service by combining **capability blocks**. A vertical template is just a
configuration that switches blocks on and sets their parameters. When a new kind of service needs
something missing, we build a new **generic block**, never vertical-specific code.

Acceptance test of the whole platform: **towing, point-to-point trucking and courier delivery are
three templates on the same code, launched by configuration only.**

## 2. Blocks to build into the core now (cheap now, expensive later)

### B1. Stops model (replaces single origin/destination)
Every order is an ordered list of stops. A one-location job has 1 stop, towing has 2, a truck or
courier route can have N.

```
order_stops(id, tenant_id, order_id, sequence, kind [pickup|dropoff|service|waypoint],
            location geography(Point), address jsonb, contact jsonb (masked),
            window_start, window_end, instructions, status [pending|arrived|done|skipped|failed],
            arrived_at, completed_at, proof jsonb, otp_hash, items jsonb)
```
- Proof (photos, OTP, signature, documents) can be required **per stop**.
- Workflow stages can be stop-aware ("arrived at stop n").
- Pricing sums routed legs; `max_stops` per tier; fee per extra stop.
- The reference schema `orders.origin/destination` become derived from the first and last stop.

### B2. Payment plans (generalises authorize/capture)
A tier or category selects a payment plan; milestones are bound to workflow stages.

| Plan | Use |
|---|---|
| `authorize_capture` | Towing, short jobs (default). |
| `prepay` | Remote services, bookings. |
| `deposit_then_balance` | Moving, scheduled jobs: capture a deposit at booking, balance at completion. |
| `milestones` | Long-haul trucking: e.g. 50% captured at pickup, 50% at delivery (avoids authorization expiry on multi-day trips). |
| `invoice` | Business accounts: no card; orders accumulate to a monthly invoice paid by payment link or transfer to the tenant/provider per the money-flow rules. |
| `reimbursable_purchase` | "Buy for me": service fee authorized upfront; agent records purchase with receipt photo; customer approves; a supplementary payment covers item cost (split to the agent's org). |
| `cash_on_delivery` | **Disabled by default, legal review required** (agent handling cash for third parties). |

```
payment_plans(id, tenant_id, code, kind, params jsonb)
payment_milestones(id, tenant_id, plan_id, stage_code, kind [authorize|capture|capture_pct|deposit|supplement], pct, fixed_minor)
```

### B3. Capacity matching
Order-level aggregates (total weight, volume, pallets, item count) computed from fields and item
lists, matched against asset capacity (`<=` rules), not only equality. Needed for trucks
(tons, pallets), towing (vehicle weight vs truck capacity) and couriers (parcel size vs vehicle).

### B4. Document generation and external filings
Templates (per tenant, per locale) rendered to PDF at stages: receipts, proof of delivery,
handover forms, consignment notes. A `RegulatoryFilingProvider` interface in the country pack for
external systems such as the TGA electronic waybill platform for land freight (verify the exact
requirement and integration, docs/16).

### B5. Business accounts (B2B customers)
```
customer_accounts(id, tenant_id, legal_name, cr_number, vat_number, credit_limit_minor,
                  payment_plan_id, billing_cycle, status)
customer_account_users(account_id, customer_id, role [admin|requester|approver], cost_center)
account_rate_overrides(account_id, rate_card_id or fee_schedule_id, override jsonb)
```
Insurers, fleets, shippers and e-commerce merchants order via console, web or API with negotiated
prices and monthly statements.

### B6. Scheduling windows and long-duration jobs
Pickup and delivery windows per stop, multi-day orders, appointment slots, SLA timers per stop.

## 3. Blocks for later phases (designed now, built when a template needs them)

| Block | Needed by |
|---|---|
| B7. Batching and route optimisation (assign several orders to one agent route; `RouteOptimizer` interface) | Last-mile e-commerce delivery, courier pools |
| B8. Cargo insurance add-on (insurer integration) | Trucking |
| B9. Shift-based capacity and recurring orders | Cleaning subscriptions, B2B routes |
| B10. Cash on delivery ledger (only after legal review) | E-commerce last mile |

Out of scope by decision: restaurant and store marketplaces (menus, carts, inventory, prep times),
a different product.

## 4. Template definitions (seed data)

| Setting | Towing | Point-to-point trucking | Courier (item delivery) |
|---|---|---|---|
| Fulfillment | point_to_point | point_to_point (N stops allowed) | point_to_point (N stops on higher plans) |
| Tracking | full_trip | full_trip | full_trip |
| Tiers | standard flatbed, hydraulic flatbed, enclosed, wheel-lift | dyna, lorry, trailer, refrigerated, crane truck | motorbike, small car, van |
| Pricing | formula + vehicle class + condition modifiers | formula (short haul) or quote (long haul) + loading/labour/waiting | formula + size/weight modifiers + extra stop fee |
| Payment plan | authorize_capture | authorize_capture (intra-city), milestones (inter-city), invoice (accounts) | authorize_capture, invoice (accounts) |
| Matching | vehicle weight/drivetrain vs truck; basement height | weight, pallets, refrigeration, hazardous licence | parcel size/weight vs vehicle, insulated box |
| Proof | photos at pickup and drop-off, receiver OTP | photos, receiver OTP or signature, proof-of-delivery PDF, e-waybill (when required) | recipient OTP, optional photo |
| Documents | receipt, handover form | consignment note, POD | receipt |

Order fields per template (summary; full definitions go into the template payloads):

- **Towing**: vehicle (reference), condition, wheels locked, location type, basement clearance
  (conditional), companion, plate, photos.
- **Trucking**: cargo type, weight (t), volume or pallets, refrigeration + temperature
  (conditional), hazardous, loading responsibility, workers count (conditional), loading time,
  declared value, recipient contact, photos.
- **Courier**: item type, weight band, fragile, description, recipient contact, delivery mode
  (hand to hand / at door), photo; delivery OTP generated automatically.

## 5. Template depth (professional, not generic)

A generic engine must never feel generic. Every template ships with:
- **Tailored UX**: its own home screen sections, order flow order, wording, icons, empty states and
  stage screens (e.g. towing shows "where is your car now", trucking starts with cargo, courier
  with "what are you sending"). Built from configurable screen blocks, not custom code.
- **Domain defaults**: fields, tiers, rate cards, fees, workflows, documents, requirements and
  notification texts written by someone who knows the trade.
- **Vertical KPIs** in consoles (towing: response time to pickup; trucking: on-time delivery and
  utilisation; courier: deliveries per hour).
- **A quality bar**: a template is "published" only after an end-to-end test on staging and a UX
  review in Arabic and English.

## 6. Passenger transport pack (later phase, gated)

Ride-hailing style services are **not marketed at launch**. They become a capability pack after
the core is proven and after TGA requirements are verified (docs/16 Q24). Initial targets are
niches: corporate employee transport, school transport, airport transfers, intercity rides,
non-emergency medical transport, event and seasonal transport (Hajj, Umrah, festivals),
women-driver services.

Blocks to add (design the core so they plug in without refactoring):

| Block | Content |
|---|---|
| Fast dispatch | Sub-10-second matching, hexagonal geo indexing (e.g. H3), demand heatmaps, driver repositioning hints, auto-accept option. |
| Rider safety | SOS, live trip sharing link, driver photo and plate verification, PIN to start trip, GPS spoofing detection, audio/incident reporting, women-only option. |
| Rider features | Precise pickup points, scheduled rides, airport queues, multiple riders, fare split, tips, lost and found. |
| Driver features | Incentives and quests, earnings dashboard, daily payouts via settlement options, fatigue limits (max online hours). |
| Payment timing | Authorize at request before driver assignment (depends on docs/16 Q3). |
| Regulatory reporting | Trip data reporting and driver/vehicle eligibility checks through a country pack adapter. |

Engine implications to respect from day one: dispatch scoring and presence must be pluggable and
horizontally scalable; payment plans must allow authorization before assignment; safety events
are first-class domain events.

## 7. Regulatory notes (verify, see docs/16)
- Towing operators and freight carriers: TGA licensing documents as category requirements.
- Land freight: electronic waybill obligations.
- Delivery apps and couriers: courier registration and app licensing rules for delivery activity.
- Passenger transport via apps: operator licensing, driver eligibility (including localisation
  rules), vehicle registration and trip data reporting.
