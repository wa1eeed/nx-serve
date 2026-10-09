# 07. Orders, Workflows and the State Machine

## 1. Two layers of status

- **Core statuses** (engine): `draft, quoting, awaiting_payment, dispatching, assigned,
  authorized, en_route, arrived, in_progress, completed, captured, cancelled, failed, disputed`.
- **Workflow stages** (per service, visible to users), each mapped to a core status via `maps_to`.

## 2. Stage definition

| Field | Meaning |
|---|---|
| `code`, `label_ar`, `label_en` | Identity and display. |
| `maps_to` | Core status entered when the stage starts. |
| `actor` | Who can trigger the transition: agent, customer, system, ops. |
| `tracking_active` | Live GPS shared with the customer during this stage. |
| `requires` | Proof to leave the stage: `photos_min`, `otp`, `signature`, `checklist[]`. |
| `payment_action` | none, authorize, capture, capture_partial. |
| `notify` | Channels per audience. Text comes from `notification_templates`. |
| `sla_minutes` | Ops alert if exceeded. |

## 3. Example workflows

**Towing (point_to_point, full_trip)**
1. `accepted` (assigned, authorize) 2. `heading_to_pickup` (en_route, tracking on)
3. `arrived_pickup` (arrived, photos_min 2) 4. `loading` (in_progress)
5. `heading_to_dropoff` (in_progress, tracking on) 6. `delivered` (completed, OTP from receiver,
photos_min 2, capture)

**AC maintenance (at_customer, en_route)**
1. `accepted` (assigned, authorize) 2. `on_the_way` (en_route, tracking on) 3. `arrived`
4. `working` (in_progress) 5. `done` (completed, photos + signature, capture)

**Consultation (remote, none)**
1. `booked` (authorized at booking or full payment) 2. `confirmed` 3. `session_started`
(in_progress) 4. `finished` (completed, capture)

## 4. Engine rules

- Transitions allowed: next stage in order, or to `cancelled` / `failed` / `disputed` per policy.
  Ops can force transitions with a reason (audited).
- Each transition writes `order_events` and an outbox event `order.stage_changed`.
- Side effects run from the stage flags (start/stop tracking session, call payment action,
  schedule SLA timer, send notifications).
- Orders keep the workflow version used at creation.

## 5. Order lifecycle (happy path)

1. Customer gets estimates (`POST /v1/estimates`) per tier: returns price, ETA, expiry.
2. Customer creates order with an estimate id, tokenized card, fields and add-ons.
3. Dispatch engine finds a provider (docs/08 section dispatch).
4. On acceptance: authorize with splits; if authorization fails, ask customer to update payment.
5. Stages progress; tracking on when flagged.
6. Completion: compute final price (actual distance/time if metered or deviation beyond
   threshold), capture, issue receipts/invoices, request ratings.

## 6. Cancellation policy (configurable per pricing/rate card)

| Moment | Default outcome |
|---|---|
| Before assignment | Free; nothing authorized or void. |
| After assignment within free minutes | Free; void. |
| After free minutes / agent en route | Cancellation fee via partial capture; fee split per fee schedule (part to provider for wasted trip). |
| After arrival | Higher fee or minimum fare. |
| Provider cancels | No fee to customer; provider reliability score drops; re-dispatch. |

## 7. Disputes and ratings

- Customer or provider can open a dispute (reason, evidence); ops resolves with refund/partial
  refund/no action. All evidence is collected automatically from the order (stages, photos, OTP
  logs, GPS trail).
- Two-way ratings after completion; ratings feed dispatch scoring.
