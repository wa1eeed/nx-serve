# Phase 1 Plan: Catalog and Configuration

Status: Draft for founder approval (2026-10-10). No application code until approved.
Source: docs/15 Phase 1, docs/02, docs/05, docs/07, docs/09 (tiers and rate cards config only),
docs/10, docs/21, docs/23, docs/24, docs/25, ADR-0003, ADR-0012, ADR-0013.

## 1. Goal

Make a service fully configurable from data. An admin configures towing end to end from the console
(verticals, categories, dynamic fields, item catalogs, tiers, availability, vehicle classes,
workflows and stages, settings, roles), the form schema endpoint renders the order form on web and
mobile, and entitlement and permission checks are enforced in the API. The engine stays generic:
launching a new service is configuration, not code (ADR-0003).

## 2. Scope

### In scope
- Domain engines (pure, property tested) in `packages/domain`:
  - field validation (attribute definitions + payload, all field types including item_list and
    reference, validation rules, conditional visibility),
  - entitlements resolver (plan version + add-ons + overrides + module dependencies to effective
    modules and limits),
  - settings resolver (values across levels with locks and min/max bounds).
- API modules (`apps/api/src/modules`): catalog (verticals, categories, fields, item catalogs,
  tiers, templates), vehicles, geo (cities, zones, availability), settings, entitlements,
  rbac (roles, permissions, assignments).
- Read endpoints for apps and the form schema endpoint; admin write endpoints for the console, all
  tenant scoped with entitlement and permission guards, scopes, idempotency, problem+json, audit and
  outbox events.
- Authorization wiring: after authentication, load the actor's permissions and the tenant's
  effective entitlements into the request context (cached in Redis, invalidated by events), and add
  `@RequireModule` and `@RequirePermission` guards.
- Template install: install the towing template into a tenant as an editable copy
  (`tenant_template_installs`), creating the vertical, categories, fields, workflow and stages,
  tiers and requirements. Seed ships the published towing template payload.
- Console screens (`apps/web-console`): verticals, category tree, field editor (all types), item
  catalogs, tiers, availability, vehicle classes, workflow and stage editor, settings, roles, and the
  template install wizard. Dense data-grid patterns from `packages/ui-web` (TanStack Table), forms
  with react-hook-form + Zod, RTL first.
- Dynamic form renderer in `packages/ui-web` (and the shared schema types) that renders the form
  schema; the mobile renderer shell in `packages/ui-native` consumes the same schema.
- Contracts: Zod schemas for every new request and response, OpenAPI and Postman updated, a
  breaking-change check added to CI against the last released spec.

### Parallel track (per docs/15): marketing site
`apps/marketing` home, towing and logistics use cases, pricing or waitlist, five guides, and the
SEO, AEO and GEO setup (docs/22). Tracked separately so it does not block the console acceptance.

### Out of scope (later phases)
Provider onboarding and dispatch (Phase 2); rate card maths, estimates, surge and the fee engine
runtime (Phase 3); orders, the workflow runtime, tracking and payments (Phase 4). Phase 1 configures
tiers and rate card rows as data but does not price orders.

## 3. Data and migrations

The tables already exist from Phase 0. Expected additions are small:
- `0017_catalog_version.sql`: a per tenant catalog version (bumped on config changes) to drive the
  form schema ETag, or compute it from max(updated_at); decide and document in the migration.
- Indexes to support console list and tree queries where the isolation and query-logging tests flag
  N+1 or slow paths.
No table is dropped; any design change gets an ADR.

## 4. Task breakdown (ordered)

1. Domain: field validation engine + tests (all types, visibility, item_list, reference).
2. Domain: entitlements resolver + settings resolver + property tests (bounds, locks, dependencies).
3. Contracts: Zod schemas for catalog, geo, vehicles, settings, entitlements, rbac, and the form
   schema; regenerate OpenAPI and Postman; add the breaking-change check to CI.
4. API authorization: context enrichment (permissions + entitlements, Redis cached), `@RequireModule`
   and `@RequirePermission` guards, `entitlement_required` and `permission_denied` problem responses.
5. API catalog module: read endpoints + the form schema endpoint (merges the four layers, resolves
   locale, applies entitlements, versioned ETag) + admin CRUD with audit and outbox events.
6. API geo, vehicles, settings, entitlements, rbac modules.
7. Template install service + the published towing template payload in seeds.
8. ui-web: dynamic form renderer from the schema, plus the console data-grid and form primitives.
9. web-console screens for every configuration area, RTL and ar/en.
10. ui-native: form renderer shell consuming the same schema.
11. Marketing site parallel track (can run alongside from task 3).
12. Tests: unit and property (domain), integration with RLS isolation for every new endpoint,
    contract tests against OpenAPI, and a Playwright flow that configures towing from the console.

## 5. API endpoints (initial, each with scopes)

Read (app and console): `GET /v1/catalog/verticals`, `/verticals/{id}`,
`/verticals/{id}/categories`, `/verticals/{id}/tiers`, `/verticals/{id}/form` (form schema),
`/catalog/item-catalogs/{id}`, `/vehicles/makes`, `/vehicles/models`, `/geo/cities`, `/geo/zones`,
`/geo/availability`, `/settings` (effective), `/entitlements` (effective).
Admin write (console): CRUD under `/v1/admin/...` for verticals, categories, fields, item catalogs,
catalog items, requirements, tiers, availability, vehicle classes and mapping, workflows and stages,
settings values, roles and assignments, and `POST /v1/admin/templates/{code}/install`.
All POST and PATCH require Idempotency-Key, enforce `@RequireModule` and `@RequirePermission`, emit
outbox events (`catalog.updated`, `settings.updated`, `role.updated`, `template.installed`) and write
audit entries.

## 6. Events

`catalog.vertical_changed`, `catalog.category_changed`, `catalog.field_changed`,
`catalog.tier_changed`, `availability.changed`, `settings.updated`, `entitlements.changed`,
`role.updated`, `template.installed`. Consumers invalidate the entitlement, settings and form schema
caches.

## 7. UI screens (web-console)

Verticals list and editor; category tree with drag ordering; dynamic field editor with per-type
options, validation, visibility rules, pricing and matching flags (admin only); item catalogs and
items; tiers with required capabilities and allowed classes; availability per city and zone with
operating hours; vehicle classes and model mapping; workflow and stage editor (maps_to, tracking,
payment_action, proof, notify, SLA); settings with lock and bounds display; roles and permission
assignment; template install wizard. All bilingual, RTL designed, with the LockedFeature pattern on
gated areas.

## 8. Risks

- The dynamic field and form schema model is the backbone of the product; get its types and
  validation exactly right and share them between API, web and mobile to avoid drift.
- Entitlement and settings resolution must be correct and cached safely (invalidate on events).
- Console scope is large; sequence by configuration area and keep each shippable.
- Keep everything generic: no towing-specific branches; towing is only seed data.

## 9. Open questions touched

None blocking. Entitlement caching strategy, the catalog version source for ETags, and the exact
field editor UX are decided during implementation and documented; nothing depends on an item in
docs/16.

## 10. Acceptance tests (from docs/15)

1. An admin configures towing entirely from the console (vertical, categories, fields, tiers,
   availability, workflow and stages), with no code change.
2. `GET /v1/catalog/verticals/{id}/form` returns a versioned schema that the web and mobile renderers
   display correctly in ar and en with RTL.
3. Entitlement and permission checks are enforced in the API: a locked module returns
   `403 entitlement_required`; a missing permission returns `403 permission_denied`.
4. The towing template installs into a fresh tenant as an editable copy.
5. RLS isolation holds for every new table and endpoint; domain engines have property tests;
   OpenAPI breaking-change check passes.
