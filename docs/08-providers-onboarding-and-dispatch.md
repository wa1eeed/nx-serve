# 08. Providers, Onboarding and Dispatch

## 1. Provider structure

- `provider_orgs`: freelancer (freelance certificate), establishment or company (CR). One Moyasar
  merchant per org. A freelancer is an org with one agent (role owner).
- `provider_agents`: field workers with roles (owner, driver, technician, dispatcher).
- `assets`: trucks, vans, equipment with dynamic attributes (`max_weight_kg`, `hydraulic`,
  `enclosed`), linked to agents over time.
- `provider_groups`: tenant-defined groups (VIP fleet, insurer-approved, night shift) used by
  dispatch policies.

## 2. Onboarding journey

1. Sign up (phone OTP), choose entity type.
2. **NX Verify**: identity, CR or freelance certificate, IBAN ownership. Results stored as
   `nx_verify_ref`.
3. Choose categories and zones to apply for.
4. Upload documents per `category_requirements` (e.g. towing: vehicle registration, operating
   permit), with expiry dates for reminders and automatic suspension on expiry.
5. Add agents and assets.
6. Moyasar merchant created via API in parallel; merchant signs via Nafath; status tracked via
   webhooks.
7. Tenant reviews each category application: approve, request info, reject (reason codes).
8. Active when both approvals exist. **Probation**: first N orders (setting) with lower dispatch
   priority and extra monitoring.

## 3. Dispatch engine

Policies (`dispatch_policies`) per vertical/category/zone/group, with fallback chain:

| Mode | Behaviour |
|---|---|
| `auto_nearest` | Rank eligible online agents; offer to the best; timeout; next; expand radius per round. |
| `broadcast` | Offer to top N eligible simultaneously; first accept wins (atomic claim). |
| `manual` | Ops or fleet dispatcher assigns from console. |
| `customer_choice` | Customer picks a provider from a list (shows ratings, price, badges). |

**Eligibility**: approved offering for category and zone; merchant active; documents valid;
agent online and not busy; asset satisfies tier `required_capabilities` and order `match_rule`s;
group restriction if any; membership limits.

**Scoring** (pure function, weights configurable): routed ETA to pickup, rating, acceptance rate,
cancellation rate, membership `dispatch_boost`, probation penalty, fairness (recent assignments).

**Atomicity**: offers and acceptance use a Redis lock + DB unique constraint so one order is
accepted once. All offers recorded in `dispatch_offers`.

## 4. Presence and location

- Agent toggles online; app sends location every 3 to 5 s while online or on a tracking stage
  (adaptive: slower when idle).
- Redis GEO set per tenant and vertical for nearest queries; `agent_presence` persisted
  periodically; `tracking_points` stored only while an order is active.
- Battery and data friendly: batching, distance filter, background mode only in provider app.

## 5. Fleet portal (web)

Fleet managers see agents on a map, assign/reassign orders (if policy allows), manage assets and
documents, view settlements and performance, and handle membership.
