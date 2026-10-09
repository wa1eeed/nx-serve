# 03. Architecture

## 1. Style

**Modular monolith** for the API (NestJS), with three deployables sharing packages:

- `api`: HTTP (internal + public `/v1`), inbound webhooks (Moyasar, NX Verify).
- `realtime`: Socket.IO gateway, stateless, scaled horizontally via Redis adapter.
- `worker`: BullMQ consumers and schedulers.

Modules talk through **public service interfaces and domain events**, never by reaching into each
other's tables. This keeps a clean path to extracting services later (dispatch, tracking and
payments are the first candidates).

```
   Mobile apps / Web apps / Third parties
              │ HTTPS (REST /v1)            │ WSS (Socket.IO)
              ▼                             ▼
        ┌───────────┐  outbox events   ┌───────────┐
        │    api    │ ───────────────▶ │  worker   │──▶ webhooks out, push, SMS,
        └─────┬─────┘                  └─────┬─────┘    billing, reconciliation
              │                              │ publish
              ▼                              ▼
     PostgreSQL 16 + PostGIS          Redis 7 (BullMQ, pub/sub, GEO, rate limit, cache)
              ▲                              │
              │                        ┌─────▼─────┐
              └────────────────────────│ realtime  │
                                       └───────────┘
   External: Moyasar, Maps routing, SMS, Push (Expo/FCM/APNs), WhatsApp, NX Verify, Nafath,
             ZATCA provider, Object storage (MinIO / Alibaba OSS)
```

## 2. Layering inside the API

```
controller (HTTP, auth guard, tenant context, validation via contracts)
  └─ application service (use cases, transactions, authorization checks)
       ├─ domain (pure functions from packages/domain: pricing, fees, splits, workflow, scoring)
       ├─ repository (Drizzle; runs inside tenant-scoped transaction)
       └─ outbox (events written in the same transaction)
```

- Request context carries: `request_id`, `tenant_id`, `actor` (user/agent/customer/api client),
  `entitlements`, `permissions`, `locale`.
- Tenant scoping: a middleware resolves the tenant from host (domain table) or credential, opens a
  transaction and runs `SET LOCAL app.tenant_id = ...`. Repositories never accept a tenant id from
  the client.

## 3. Engines in `packages/domain` (pure, heavily tested)

| Engine | Input | Output |
|---|---|---|
| Field validation | attribute definitions + payload | validated attributes or errors |
| Pricing | tier, rate card, route, class, zones, surge, modifiers, add-ons | itemized estimate, auth amount |
| Fees | fee schedule, order amounts, payment method | fee lines per bearer, VAT |
| Splits | pricing + fees + gateway fee bearer + promo | Moyasar `splits[]` (sums verified) |
| Workflow | workflow definition, current stage, event, actor | next stage, side effects (payment action, tracking flag, required proof) |
| Dispatch scoring | candidates (distance, rating, membership boost, capability match, load) | ranked list |
| Entitlements | plan version, add-ons, overrides, module dependencies | effective modules + limits |
| Settings | values at each level with locks/bounds | effective value per key |
| Licence billing | price components, usage | invoice lines with bracket details |

## 4. Events (outbox)

Naming: `<aggregate>.<past_tense>` e.g. `order.created`, `order.stage_changed`,
`order.completed`, `payment.authorized`, `payment.captured`, `payment.refunded`,
`provider.approved`, `agent.location_updated` (high-frequency, Redis only, not outbox).

Envelope: `{ id (uuidv7), type, tenant_id, occurred_at, version, data, actor }`.
Consumers are idempotent by `id`.

## 5. Caching

- Effective entitlements and settings per tenant: Redis, invalidated by events.
- Catalog/config payloads for apps (services, fields, tiers, stages): versioned ETags; apps cache
  and revalidate.
- Surge multipliers per zone: Redis with TTL.

## 6. Scalability targets (initial)

- 2,000 concurrent online agents per tenant sending a location every 3 to 5 seconds.
- 50 orders per second platform-wide burst.
- p95 API latency < 200 ms for reads, < 400 ms for order creation (excluding gateway calls).

## 7. External adapters (interfaces in `packages/integrations`)

`PaymentGateway` (Moyasar), `MapsProvider` (routes, distance matrix, geocoding, ETA),
`SmsProvider`, `PushProvider`, `WhatsAppProvider`, `EmailProvider`, `StorageProvider`,
`IdentityVerifier` (NX Verify), `NationalIdentity` (Nafath), `EInvoicingProvider` (ZATCA).
Every adapter has a fake implementation for tests and local development.
