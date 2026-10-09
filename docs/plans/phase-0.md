# Phase 0 Plan: Foundation

Status: Draft for founder approval (2026-10-09, reflects docs/25 capability blocks). No application
code until approved.
Source: docs/15 Phase 0, CLAUDE.md sections 2 to 4 and 7, docs/03, docs/04, docs/11, docs/13,
docs/18, docs/19, docs/24, docs/25, ADR-0001, ADR-0002, ADR-0007, ADR-0008, ADR-0013.

## 1. Goal

Stand up the skeleton the whole platform is built on: a typed monorepo, the database with tenant
isolation proven by tests, authentication and tenant resolution, the event outbox, audit and
idempotency, the OpenAPI pipeline with a developer portal skeleton, the i18n and design token base,
seed data for the full local towing scenario, and a production identical staging target. No business
features yet; the structure is general (capability blocks included) so later phases add verticals and
templates by configuration only.

## 2. Scope

### In scope
- Monorepo: pnpm workspaces plus Turborepo, package scope `@nxserve/*`, strict TypeScript, shared
  eslint, prettier and tsconfig in `packages/config`, module boundary lint rules, Conventional
  Commits, Changesets.
- Exact repository layout from CLAUDE.md section 4.
- `packages/contracts`: Zod schemas, DTOs, event envelopes, stable error codes, problem+json shape,
  OpenAPI 3.1 generation.
- `packages/db`: SQL migrations converted from the reference schema with the docs/04 rules and the
  docs/25 capability blocks, Drizzle schema mirror, seeds, and RLS test helpers.
- `packages/domain`: money minor unit and currency exponent helpers, UUIDv7 generator, rounding
  helpers, settings and entitlements resolver interfaces (stubs where full logic is a later phase),
  all pure and unit tested.
- `packages/integrations`: adapter interfaces plus fake implementations for PaymentGateway,
  MapsProvider, SmsProvider, PushProvider, WhatsAppProvider, EmailProvider, StorageProvider,
  IdentityVerifier (NX Verify), NationalIdentity (Nafath), EInvoicingProvider (ZATCA), and a
  RegulatoryFilingProvider placeholder (docs/25 B4). A console or log NotificationProvider so the
  pipeline exists end to end.
- `packages/i18n`: en source catalog and ar catalog at full parity, ICU MessageFormat, glossary,
  parity and ICU CI checks.
- `packages/design-tokens`, `packages/ui-web`, `packages/ui-native`: one token source, light and
  dark, RTL base, a minimal component set and the LockedFeature component shape.
- `packages/sdk-js`: generation wiring (output produced by CI from OpenAPI).
- `apps/api`: NestJS with Fastify; tenant resolution middleware (host via tenant_domains and
  credential), request context (request_id, tenant_id, actor, entitlements, permissions, locale),
  tenant scoped transactions with `SET LOCAL app.tenant_id`, problem+json error filter, idempotency
  middleware, audit interceptor, outbox writer in the request transaction, auth module (customer and
  agent phone OTP, staff email plus password argon2id plus mandatory TOTP MFA for admins, short
  access JWT and rotating refresh tokens with reuse detection), rate limit headers, health and
  readiness, OpenAPI generation.
- `apps/worker`: BullMQ; outbox publisher to Redis channels, websocket rooms, webhooks and
  notifications; graceful shutdown; dead letter queue; skeleton scheduled jobs.
- `apps/realtime`: Socket.IO with Redis adapter; auth and tenant bind at connection; room helpers.
  Dispatch and presence interfaces kept pluggable and horizontally scalable from day one so the
  later passenger transport pack fits without refactoring (docs/25 section 6).
- `apps/developers`: portal skeleton rendering the OpenAPI reference plus a quickstart placeholder.
- `apps/web-storefront`: minimal host resolved shell that renders the seeded tenant name and theme.
- `apps/marketing`, `apps/web-platform-admin`, `apps/web-console`: minimal Next.js shells wired to
  design tokens, i18n and RTL so they build in CI and compose.
- CI: lint, typecheck, unit and integration tests, build, OpenAPI generate plus Spectral lint plus
  breaking change diff, migration check, dependency audit, i18n parity, image build and scan, SBOM,
  Postman and SDK and portal generation on release.
- `infra/compose`: docker-compose with postgis/postgis:16-3.4, redis:7, minio, mailpit.
- `infra/docker`: one multi stage, non root, healthchecked Dockerfile per deployable.
- `infra/coolify`: staging service list, env templates, domains and exact setup steps.
- Seed data (docs/04 section 5): nx and demo tenants, Riyadh, Jeddah and Dammam with boundaries,
  Riyadh zones, vehicle catalog sample, towing template installed for nx and demo, three provider
  orgs with agents, assets and approved offerings, staff users per role, one API test key.

### Out of scope (later phases)
Catalog and console screens (Phase 1), provider onboarding and Moyasar merchant creation (Phase 2),
pricing and fee engines (Phase 3), the order engine with stops and payment plans behaviour, dispatch,
tracking, capture and the apps, plus trucking and courier templates launched by configuration
(Phase 4), realtime and notification hardening (Phase 5), public API completeness (Phase 6),
commercial white label and billing and business account billing UI (Phase 7), production on SCCC
(Phase 8), passenger transport pack (Phase 9). In Phase 0 the capability block tables are created but
their behaviour is not built.

## 3. Data and migrations (convert the reference schema plus docs/25, do not run the reference)

Apply the docs/04 rules to every table:
1. UUIDv7 primary keys generated in the application.
2. Money as `bigint` minor units with a `_minor` suffix plus a `currency` column; fractional rates
   stay numeric with documented rounding.
3. Every tenant and NX authored text becomes one `jsonb` column shaped `{"en": "...", "ar": "..."}`,
   validated by Zod, with fallback to the tenant default locale then en.
4. Tenant scoped unique constraints (customers.mobile, provider_agents.mobile, verticals.code,
   provider_orgs.moyasar_merchant_id, webhook_events.event_id per gateway account, and similar).
5. `tenant_id` declared in CREATE TABLE, composite foreign keys `(tenant_id, id)` on hot
   relationships.
6. RLS on every tenant table with FORCE ROW LEVEL SECURITY, both USING and WITH CHECK clauses,
   `current_setting('app.tenant_id', true)`, app connects as a non owner role, super admin uses a
   separate BYPASSRLS role, every bypass audited. Decide RLS for staff and role tables.
7. Add audit_logs, outbox_events and idempotency_keys.
8. Partition tracking_points, order_events and audit_logs monthly with default partitions and
   retention jobs; add indexes and the missing tracking_points structure.

Capability blocks from docs/25 that change the schema and are created now (behaviour later):
9. Stops model: new `order_stops` table; orders.origin and destination become derived from the first
   and last stop (derived or removed). This is a design change to the validated schema and is
   recorded in ADR-0014.
10. Payment plans: `payment_plans` and `payment_milestones` tables bound to workflow stages;
    cash_on_delivery disabled by default behind a setting pending legal review (docs/16 Q23).
11. Business accounts: `customer_accounts`, `customer_account_users`, `account_rate_overrides`.
12. Capacity aggregates on orders and a RegulatoryFilingProvider interface placeholder.

Planned ADRs during implementation: ADR-0014 stops model and payment plans; RLS enforcement details
(FORCE, WITH CHECK, non owner role, SET LOCAL, pooling); migration tooling choice; the translatable
jsonb text convention.

## 4. Task breakdown (ordered)

1. Repo and tooling: workspaces, Turborepo, tsconfig and lint and prettier configs, commit and
   changeset tooling, CI skeleton. Files: root configs, packages/config.
2. Contracts base: problem+json, error codes, event envelope, pagination and idempotency header
   contracts, OpenAPI generator. Files: packages/contracts.
3. Domain primitives: money and currency exponent helpers, UUIDv7, rounding, with property tests.
   Files: packages/domain.
4. DB migrations: convert the reference schema section by section with the docs/04 rules; add the
   docs/25 capability block tables (order_stops, payment_plans, payment_milestones, customer_accounts
   and related, capacity aggregates); add audit, outbox, idempotency; partitions; RLS with FORCE and
   WITH CHECK. Record ADR-0014. Drizzle mirror. Files: packages/db/migrations, packages/db/schema.
5. RLS test helpers and isolation suite (Testcontainers Postgres plus PostGIS): prove cross tenant
   read and write fail for every tenant table. Files: packages/db tests.
6. Integrations: interfaces and fakes, console NotificationProvider, RegulatoryFilingProvider
   placeholder. Files: packages/integrations.
7. API core: Fastify bootstrap, config, logging (pino with request and tenant ids), tenant
   resolution middleware, request context, tenant scoped transaction manager with SET LOCAL,
   problem+json filter, idempotency middleware, audit interceptor, outbox writer, health and
   readiness. Files: apps/api/src/common, modules/tenancy.
8. Auth module: staff password plus TOTP MFA, customer and agent OTP, JWT and refresh rotation with
   reuse detection, scopes model, API key auth for the public API. Adds auth tables in migrations.
   Files: apps/api/src/modules/auth.
9. Worker: outbox publisher, queues, graceful shutdown, dead letter. Files: apps/worker.
10. Realtime: Socket.IO with Redis adapter, auth and tenant bind, rooms, pluggable dispatch and
    presence interfaces. Files: apps/realtime.
11. i18n base: catalogs, glossary, ICU, parity check. Files: packages/i18n.
12. Design tokens and ui base with RTL and LockedFeature. Files: packages/design-tokens,
    ui-web, ui-native.
13. Web app shells and the host resolved storefront. Files: apps/*.
14. Developer portal skeleton rendering OpenAPI. Files: apps/developers.
15. Seeds and `pnpm db:reset`. Files: packages/db/seeds.
16. Docker, compose, CI completion (OpenAPI lint and breaking change, Postman and SDK and portal
    generation), infra/coolify docs.
17. Staging deploy on Coolify (depends on infrastructure access and a domain, Q25 and Q26).

## 5. API endpoints (Phase 0 minimum, each with scopes)

- `GET /v1/health`, `GET /v1/ready` (public).
- `POST /v1/auth/otp/request`, `POST /v1/auth/otp/verify` (customer and agent).
- `POST /v1/auth/staff/login`, `POST /v1/auth/mfa/verify`, `POST /v1/auth/token/refresh`,
  `POST /v1/auth/logout`.
- `GET /v1/app/bootstrap` (tenant theme, locales, enabled flags) resolved by host or key.
- `GET /v1/me` (actor context echo).
All POSTs require Idempotency-Key; errors use problem+json; all are covered by contract tests against
the generated OpenAPI.

## 6. Events (outbox, Phase 0)

Envelope `{ id (uuidv7), type, tenant_id, occurred_at, version, data, actor }`. Phase 0 proves the
mechanism with `auth.staff_logged_in` and a generic `tenant.bootstrap_requested`; the publisher and
idempotent consumer path are exercised by tests. Order, payment and safety events arrive in later
phases; safety events are reserved as first class domain events for the passenger pack (docs/25).

## 7. UI screens (Phase 0)

Minimal: storefront shell showing the resolved tenant name and theme in ar and en with correct RTL,
and a developer portal landing with the API reference. Console and admin are shells only.

## 8. Risks

- PgBouncer transaction pooling plus SET LOCAL: must run inside a transaction; document and test.
- Coolify wildcard TLS and on demand TLS for custom domains: validate with a real test domain.
- Large schema conversion (money, jsonb text, UUIDv7, RLS, stops model, payment plans) is the biggest
  effort; stage it section by section with tests after each, and record ADR-0014 for the stops change.
- SCCC service availability is deferred to Phase 8 (docs/16 Q18); no production work in Phase 0.
- Payments remain sandbox only and behind a feature flag until the Moyasar addendum is signed; the
  PaymentGateway interface keeps the gateway replaceable (founder guidance 2026-10-09).

## 9. Open questions touched

Q1, Q3, Q4, Q5, Q6, Q9, Q16, Q17, Q18, Q23 (cash on delivery default off), and the new Q25 and Q26.
All handled behind interfaces, settings or feature flags; none assumed resolved. The regulatory
questions Q21, Q22 and Q24 concern later phases (courier, freight, passenger) and are not touched in
Phase 0.

## 10. Blockers needing a founder decision before or during Phase 0

- B1 (Q25): a confirmed platform or at least staging domain with DNS control, for wildcard
  subdomains, cookie and email sender domains and seed slugs.
- B2 (Q26): access to a VPS with Coolify plus an S3 compatible backup target, otherwise Phase 0
  finishes locally and in CI and documents the Coolify setup, deferring the live staging acceptance.
Everything else is decided during implementation and documented.

## 11. Acceptance tests (from docs/15)

1. `pnpm i && pnpm dev` runs every service locally against docker-compose; `pnpm db:reset` migrates
   and seeds the demo data.
2. The isolation suite proves cross tenant reads and writes fail for every tenant table.
3. Staging is reachable on Coolify with TLS and a wildcard subdomain resolving a seeded tenant
   (depends on B1 and B2).
4. OpenAPI, the Postman collection and the developer portal are generated and published from CI.
5. Additional internal gates: i18n ar and en parity passes, OpenAPI Spectral lint and breaking
   change check pass, money helpers have property tests, every touched module has a README.
