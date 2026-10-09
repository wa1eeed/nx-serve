# 04. Data Model and Multi-Tenancy

## 1. Reference schema

`database/reference-schema.sql` is the approved design (PostgreSQL 16 + PostGIS 3). It was
validated by loading it into a clean database (94 tables, no errors). Sections:

1. Geography (cities, zones)
2. Service catalog (verticals, categories, attribute definitions, item catalogs, category requirements)
3. Providers (orgs, agents, assets, groups, offerings, documents, add-ons, presence)
4. Pricing rules (strategy selection) and fee engine (4b)
5. Dispatch policies
6. Orders (orders, items, add-ons, offers, events, media, tracking points)
7. Payments (payments, splits, webhook events)
8. Multi-tenancy (tenants, domains, payment gateways, apps, builds, API clients, webhooks, subscriptions) + RLS
9. Workflows, service templates, modules, plans, entitlements, roles and permissions
10. Uber-style pricing, vehicle catalog, service tiers, availability, rate cards, zones, surge, estimates
11. Flexible licence billing
12. Tenant to provider memberships
13. Hierarchical settings with locks

## 2. Implementation rules (apply when converting to migrations)

1. **Migrations are SQL files** in `packages/db/migrations`, numbered, reviewed, and run by a
   migration tool in CI and at deploy. Drizzle schema mirrors them for typing.
2. **Primary keys: UUIDv7** generated in the application (time-ordered, index-friendly).
3. **Money: `bigint` minor units** with `_minor` suffix (e.g. `final_amount_minor`) and a
   `currency` (ISO 4217) on the owning row; exponent from ISO 4217 (SAR 2 = halalas, KWD/BHD/OMR 3).
   The reference schema uses `numeric(12,2)` for readability; convert all monetary columns. Rates
   and per-unit prices that can be fractional (per km, per minute, percentages) stay `numeric`
   and results are rounded to minor units with documented rounding.
3b. **Translatable text**: every user-facing text column defined by tenants or NX (`name_ar` +
   `name_en`, `label_ar` + `label_en`, `description_*`) becomes one `jsonb` column (`name`,
   `label`, `description`) shaped `{"en": "...", "ar": "..."}`, validated by Zod, with fallback to
   the tenant default locale then `en`. This allows any future language without migrations.
3c. **Country-specific values** (VAT rate, tax rules, phone country, currency, units, gateway,
   e-invoicing provider) come from the tenant's country pack and settings, never hard-coded.
4. **Scope unique constraints by tenant**: `verticals.code`, `customers.mobile`,
   `provider_agents.mobile`, `provider_orgs.moyasar_merchant_id`, `webhook_events.event_id`
   (per gateway account), `tenant_apps.ios_bundle_id` etc. become `UNIQUE (tenant_id, ...)` where
   appropriate.
5. **Add `tenant_id` from the start** in `CREATE TABLE` (the reference adds it in a loop for
   brevity). Composite foreign keys `(tenant_id, id)` on hot relationships prevent cross-tenant links.
6. **RLS on every tenant table** with `FORCE ROW LEVEL SECURITY`; the application connects as a
   non-owner role. A super admin role with `BYPASSRLS` is used only by the platform-admin backend
   and every use is audited.
7. **Timestamps**: `timestamptz`, UTC in DB, rendered in `Asia/Riyadh` (or city timezone).
8. **Soft delete** only where business needs it (`archived_at`); hard delete for PDPL erasure via
   dedicated procedures that anonymise orders while keeping financial records.
9. **Partitioning**: `tracking_points` (monthly), `order_events` and `audit_logs` (monthly) once
   volume requires. Retention jobs drop old partitions per policy.
10. **JSONB** is used for flexible attributes and configuration payloads; every JSONB column has a
    Zod schema in `packages/contracts` and is validated on write.
11. **Audit log table** (add): `audit_logs(id, tenant_id, actor_type, actor_id, action, entity,
    entity_id, before, after, ip, user_agent, created_at)` for all admin and money-affecting actions.
12. **Outbox table** (add): `outbox_events(id, tenant_id, type, payload, created_at,
    published_at, attempts)` with a publisher in the worker.
13. **Idempotency table** (add): `idempotency_keys(tenant_id, key, request_hash, response,
    created_at)` for POST endpoints (24 h retention).

## 3. Tenant resolution

| Caller | How tenant is resolved |
|---|---|
| Web storefront / console | `Host` header mapped via `tenant_domains` (subdomain or verified custom domain). |
| Mobile apps (branded) | App build embeds tenant slug; shared NX app uses tenant chosen at onboarding or deep link. |
| Public API | API key or OAuth client belongs to one tenant. |
| Super admin | No tenant context by default; impersonation sets it explicitly and is audited. |

## 4. Global vs tenant data

Global (no tenant_id): cities (+ boundaries), vehicle makes/models/body types, modules, plans,
plan versions, limit definitions, permissions, setting definitions, NX service templates and NX
global workflow templates (tenant_id NULL).

Tenant-scoped: everything else, including installed copies of templates, which the tenant edits
freely. Template updates from NX are offered as an "upgrade available" diff, never forced.

## 5. Seed data

- Tenants: `nx` (platform owner) and `demo`.
- Cities: Riyadh, Jeddah, Dammam with boundaries; Riyadh zones (north, south, east, west, centre,
  airport).
- Vehicle catalog sample: 10 makes, 40 models, body types.
- Towing template installed for `nx` and `demo`: categories, fields, tiers (standard flatbed,
  hydraulic flatbed, enclosed), workflow stages, rate cards for Riyadh, fee schedule, dispatch policy.
- Providers: 3 orgs (1 freelancer, 2 fleets), 6 agents, 6 assets, approved offerings.
- Staff users for each role; one API test key.
