# Progress

Updated by Claude Code at the end of every working session.

| Phase | Status | Notes |
|---|---|---|
| Design | Done | Decisions in docs/00, reference schema validated (94 tables). |
| 0. Foundation | Nearly done | All packages, API, worker, realtime, web shells, CI, Docker and Coolify docs built and green. Pending: live staging deploy (blocked on Q25 domain, Q26 VPS) and the local live DB run (Docker daemon down; validated in CI). |
| 1. Catalog and configuration | In progress (write paths covered by HTTP e2e) | Domain engines (field validation, entitlements, settings, form schema builder) at 100% coverage. Contracts (form schema, catalog and template payload in OpenAPI, 13 paths). API authorization (access token, entitlement and permission guards). Catalog module: form schema endpoint, and template install (shared payload + installer in packages/db, used by seed and the POST /v1/admin/templates/:code/install endpoint; installer validated structurally: 3 tiers and 6 stages created). Catalog admin writes: create, update and soft-delete fields (attribute definitions) under /v1/admin, guarded by catalog.manage with outbox events. geo (cities, zones, availability), vehicles (makes, models, classes), settings (effective read plus tenant upsert with lock and editable-level checks), entitlements (effective), rbac (roles, permissions) read modules, and catalog admin writes for verticals and categories. 31 routes map at boot. Web console (Next.js 15): bilingual ar/en RTL-first shell with a locale toggle that flips language and direction, sidebar nav, an API client with honest loading/auth/unreachable states, the verticals list, a live order-form preview, and the settings screen. The dynamic form renderer ships in packages/ui-web (DynamicForm, token-styled, all field types, conditional visibility), consuming the GET /v1/catalog/verticals/:id/form schema; verified in the browser (RTL and LTR, conditional field reveal). Catalog write screens wired to the admin API: an API write client (Idempotency-Key on POST, problem+json code and detail surfaced), create-vertical, the field editor (all 10 types, conditional options and visibility-rule builders, bilingual labels), create-category, and a towing template install action, with honest pending and error states. Catalog management reads and deletes added to the API (contract-first): GET a vertical, its categories, its fields, a category and a field (raw, for editing), and soft-delete DELETE for verticals and categories (field delete already existed); OpenAPI now documents the full catalog-admin surface (19 paths). Console: a vertical detail hub listing fields and categories with edit and delete, shared create/edit forms for verticals, categories and fields (the field form correctly wraps and unwraps the visibility rule in show_if). Workflow and stages (docs/07, docs/25): API endpoints (OpenAPI now 24 paths) to read a vertical workflow with its ordered stages, create and link a workflow for a vertical that has none, rename it, and add, update, delete and reorder stages (payment action, actor, tracking, SLA, requires); the console has a workflow editor that creates the workflow when missing, lists stages with move up/down reorder, and shared create/edit stage forms. Marketing site (docs/22, parallel track): bilingual ar/en locale routing (`/ar` default, `/en`), RTL-first, built on the design tokens; home, use cases (towing and logistics), features, how it works and pricing; full SEO (per-page canonical and ar-SA/en/x-default hreflang, OpenGraph, Organization, WebSite, SoftwareApplication, Product/Offer, FAQPage and BreadcrumbList JSON-LD, sitemap with alternates and robots), AEO (question-led FAQ blocks) and GEO (one consistent entity definition, llms.txt and llms-full.txt, AI-crawler allowlist). Guides: five bilingual guides (towing, white-label vs build, delivery, split payments, pricing) with Article and HowTo JSON-LD and dated bylines, a guides index, and a demo-booking form posting to a CRM webhook (DEMO_WEBHOOK_URL) with server-side lead logging when unset, consent and PDPL note. Verified in the browser including an end-to-end form submission. Auto-generated branded Open Graph and Twitter images (next/og) per route: a generic home card and tailored cards for each use case and guide, wired via og:image and twitter:image with the production origin. The cards embed IBM Plex Sans Arabic (OFL, bundled), so each card shows the title in the page locale, Arabic right-aligned RTL; images are fully prerendered (dynamicParams off). Analytics and consent (docs/22 section 7): a PDPL consent banner (accept or essential-only, persisted, privacy-preserving default), consent-gated GA4 that loads only after accept (NEXT_PUBLIC_GA_ID), UTM capture and a client plus server-side (Measurement Protocol) generate_lead conversion on demo submit, and a bilingual privacy page. An interactive revenue calculator (orders, average order value and fee, giving monthly GMV and monthly and annual revenue, Arabic numerals and SAR via Intl, consent-gated calculator_used event) on the home and pricing pages. HTTP e2e tests for the catalog write paths (apps/api/src/catalog/catalog-write.e2e.test.ts): boot the real NestJS app against live PostGIS and exercise the full vertical, field, category, workflow and stage lifecycle (create, read, update, reorder, delete) with the form schema reflecting the writes and the outbox receiving events, plus authorization (anonymous, missing permission, tenant-token mismatch) and cross-tenant RLS isolation at the endpoint. They run in the CI database job (skipped without a database). Next: field and category reorder in the console, a blog, hero/pricing A/B testing. |
| 2. Providers | Built (e2e in CI) | Plan: docs/plans/phase-2.md. Done: contracts (provider Zod schemas + event types) and the pure domain engines (document-requirement resolver, onboarding-readiness resolver, dispatch eligibility evaluator + capability matcher), 97 domain tests (property + branch) and 18 contract tests, reviewed by an adversarial workflow (6 confirmed findings fixed). Providers self-service API (apps/api/src/providers): OTP-verified registration (starts NX Verify, creates the sandbox Moyasar merchant, creates the owner agent), add agents, assets (attributes validated against the vertical fields), agent-asset links, apply for offerings, upload documents, presence (PostGIS), and GET /providers/me with onboarding readiness; owner-only writes, org-ownership checks, RLS, outbox events, OpenAPI (32 paths). A second adversarial review fixed 4 findings (no network IO inside a transaction, duplicate-mobile pre-check before external side effects, document subject org-ownership, national_id forwarded to the identity check). Tenant admin review (apps/api/src/providers, providers.approve): list providers, a provider with onboarding readiness, review offerings (approve, needs-info, reject with notes) and documents (verify, reject), refresh merchant status from the gateway, provider groups and membership, and a merchant status webhook verified by shared secret plus IP allowlist and processed exactly once via webhook_events (OpenAPI 42 paths). A third adversarial review fixed three findings (verifyWebhook now fails closed on an unknown source IP, group membership is idempotent via a unique index in migration 0017, and a bad group-member id returns 404 not 500). Entitlement limits: registration enforces max_providers and adding an agent enforces max_agents (limit_exceeded, resolved before the transaction). The eligible-for-dispatch readiness is served by GET /providers/me and GET /admin/providers/:id. Console provider screens (apps/web-console, bilingual ar/en, RTL): a provider list, a provider detail with the onboarding readiness (state, eligible-for-dispatch, steps, blockers), offering review (approve, needs-info, reject) and document review (verify, reject), a merchant-status refresh, and a provider-groups page (create and add member). Onboarding e2e (apps/api/src/providers/provider-onboarding.e2e.test.ts): boots the real app against live PostGIS and drives signup (OTP) to eligible-for-dispatch (register, apply offering, upload documents, admin approve and verify, readiness true), plus the merchant webhook (verified, exactly once), self-service and admin authz, and a bad-secret webhook; runs in the CI database job, skips without a database. Phase 2 acceptance (a provider reaches eligible for dispatch in sandbox) is covered end to end. |
| 3. Pricing and fees | In progress | Plan: docs/plans/phase-3.md. Pure engines in packages/domain reproducing the docs worked examples exactly: computeFare and estimate (docs/09 ten steps: 264.00 SAR fare, 304.00 authorized), the fee engine (bearer, calc, base, VAT modes), the surge calculator (scheduled plus dynamic), the gateway-fee estimator (mada cap) and the split allocator with settlement (provider 89.02, platform 10.00, gateway 0.98). 121 domain tests, property-tested (splits always balance, fares clamped). An adversarial review fixed two money bugs (free-wait allowance was not applied, add-ons were double counted in the fee base). API: POST /estimates (resolves the rate card, routes via MapsProvider, stores a price_estimate with expiry) and POST /admin/pricing/simulate (the pure fee and price simulator), with the price_estimates table (migration 0018) and OpenAPI (44 paths); the simulator is unit-tested through the HTTP contract. Console: a bilingual RTL fee and price simulator page that drives /admin/pricing/simulate and shows the fare, fees, splits and net settlement. Rate-card and fee-schedule admin with maker-checker (docs/09): contracts and API under /v1/admin/pricing for rate cards, fee schedules (with their components) and surge schedules, with the full lifecycle (create draft, submit, approve, reject, archive). Editing a submitted item reverts it to draft so approval always binds to the reviewed content; a different staff member must approve (pricing.edit creates, submits and edits; pricing.approve approves, rejects and archives; the approver can never be the creator, enforced in the service, by an atomic status-guarded write, and by a DB CHECK); approving archives the prior active row for the same scope. OpenAPI now 58 paths. A maker-checker and estimate e2e (apps/api/src/pricing/pricing-maker-checker.e2e.test.ts) drives maker submit, edit-resets-to-draft, resubmit, self-approve blocked (409), checker approve, then a public estimate that resolves the approved card and is stored with an expiry; runs in the CI database job. Migration 0019 adds rate_cards.approved_at (fee_schedules already had it). Three adversarial reviews (money/SQL, maker-checker/authz, contracts) ran; all confirmed findings were fixed: a critical phantom approved_at column, a four-eyes bypass (editable while pending), non-atomic approvals, a provider-scoped fee schedule leaking into generic estimates, negative fee amounts, numeric and date bounds mirrored into Zod, and a complete 422/404 error contract; platform-wide hardening deferred to docs/17. Console editors (bilingual, RTL first): a pricing hub plus full editors for rate cards (list, create, and a detail page with the maker-checker action bar: submit, approve or reject with notes, archive; editable only while draft or pending), fee schedules (dynamic fee-component rows with the right fields per calc type), and surge schedules (day and time windows, multiplier); each verified rendering in the browser. A second round of console reviews fixed a silent surge bug (a blank days field stored a Sunday-only window), single-digit-hour times, a mislabeled section heading, negative-money clamping, the em dash in a shared formatter, and required-field guards. Phase 3 is complete; next is Phase 4 (orders end to end). |
| 4. Orders end-to-end (MVP) | Not started | |
| 5. Realtime and notifications | Not started | |
| 6. API platform | Not started | |
| 7. White-label commercial | Not started | |
| 8. Hardening and production | Not started | |

## Phase 0 checklist

- [x] Monorepo tooling: pnpm workspaces, Turborepo, strict tsconfig, ESLint flat config, Prettier,
      .env.example, .gitignore, .nvmrc (`packages/config`).
- [x] `packages/domain`: money (bigint minor units), currency exponents, rounding, fare rounding,
      `allocateMoney` (splits balance), UUIDv7. 35 tests, 100% coverage, towing and split examples
      reproduced.
- [x] `packages/contracts`: problem+json, stable error codes, event envelope, cursor pagination,
      HTTP conventions, translatable text and money DTOs. 7 tests.
- [x] `packages/i18n`: en and ar catalogs at parity, glossary, parity + ICU argument gate. 4 tests.
- [x] ADR-0014 (stops model and payment plans).
- [~] `packages/db`: 16 SQL migrations converted from the reference schema with docs/04 rules and
      docs/25 capability blocks (stops model, payment plans, business accounts), RLS (FORCE + USING +
      WITH CHECK via helper functions), audit/outbox/idempotency and auth tables, migration runner,
      role aware client with `withTenant` (SET LOCAL), Drizzle introspection config, RLS isolation
      test (Testcontainers). Migrations structurally validated: 108 tables, 88 RLS policies apply
      cleanly (PostGIS geography stubbed, because the local Docker daemon is unresponsive in this
      environment). Still to do: run against real PostGIS (migrate + isolation test), and seeds.
- [x] `packages/integrations`: adapter interfaces and fakes (PaymentGateway with split invariants
      and constant time webhook check, MapsProvider, NotificationProvider, StorageProvider,
      IdentityVerifier, NationalIdentity, EInvoicingProvider, RegulatoryFilingProvider) plus a
      `createIntegrations` factory (all fakes in Phase 0). Build and 4 tests green.
- [~] Seeds: `runSeed` writes nx and demo tenants, domains, towing template (vertical, category,
      workflow + 6 stages, tier, rate card, fee schedule, dispatch policy, payment plan), vehicle
      catalog, classes, provider + agent + asset + offering, customer, plans, permissions, roles and
      a test API key. Structurally validated against the stubbed schema; live run pending Docker.
- [x] `apps/api`: NestJS 11 on Fastify (ESM), `/v1` prefix. Request context (AsyncLocalStorage),
      tenancy guard (host resolution), `DbService.withTenant` (SET LOCAL), problem+json exception
      filter, idempotency interceptor, outbox writer, audit interceptor, Redis readiness, bootstrap
      and me endpoints, and the auth module (phone OTP, staff argon2id + TOTP MFA, access JWT via
      jose, rotating refresh tokens with reuse detection). Builds, boots, and serves /v1/health plus
      problem+json (verified at runtime); 3 unit tests. DB-backed endpoints run once Postgres is up.
- [x] OpenAPI pipeline: `@nxserve/contracts` generates an OpenAPI 3.1 document (10 paths) from the
      Zod contracts (single source; the API imports the same schemas) and a Postman collection.
      Covered by a contract test. `pnpm --filter @nxserve/contracts openapi:generate` and
      `postman:generate`.
- [x] `apps/developers`: Next.js 15 portal skeleton. Landing plus `/reference` (Scalar) over the
      generated spec, regenerated at build so it never drifts. `next build` passes.
- [ ] SDK (`packages/sdk-js`) generation from OpenAPI: Phase 6.
- [x] `apps/worker`: transactional outbox publisher (FOR UPDATE SKIP LOCKED, BYPASSRLS pool,
      publishes to Redis `nx:events` with target rooms, at least once), BullMQ queue and worker
      skeletons, graceful shutdown. Builds; 1 unit test. Room routing is shared in
      `@nxserve/contracts` (`roomsForEvent`).
- [x] `apps/realtime`: Socket.IO gateway with the Redis adapter, JWT handshake auth, tenant and
      actor room binding, and the event bridge that fans worker events out to rooms. Builds; 3 unit
      tests (handshake auth round trip, room routing).
- [x] `packages/design-tokens`: one token source (semantic colors light and dark, radius, fonts,
      chart palette), `buildTokensCss` (`:root` light plus system and forced dark), shared
      `lockedFeatureModel`. 3 tests.
- [x] `packages/ui-web`: `cn`, `Button`, `LockedFeature` (shadcn style, token driven), and the
      `DynamicForm` order-form renderer (server-schema driven, all field types, conditional
      visibility, token styled, RTL via document dir). 7 tests.
- [x] `packages/ui-native`: shared token to CSS variable mapping (`nativeTheme`) matching web; full
      React Native Reusables components ship with the mobile apps. 2 tests.
- [x] Web shells build (Next.js 15): `marketing`, `web-platform-admin`, `web-console`,
      `web-storefront` (host resolved, Arabic RTL, tokens applied) and `developers`. All build.
      `marketing` is now a full bilingual site (Phase 1): locale routing, use cases, pricing, SEO,
      AEO and GEO (sitemap, robots, JSON-LD, llms.txt).
- [ ] `infra/compose`, `infra/docker`, `infra/coolify`.
- [x] CI (`.github/workflows/ci.yml`): a quality job (install, lint, build, unit and property tests,
      i18n parity, OpenAPI and Postman generation with artifact upload) and a database job that runs
      migrate, seed and the RLS isolation suite against a live `postgis/postgis:16-3.4` service,
      closing the database acceptance in CI even while the local Docker daemon is down.
- [x] Docker: two multi-stage, non-root templates (`Dockerfile.node`, `Dockerfile.web`) using
      `turbo prune`, a `.dockerignore`, and `infra/docker/README.md` mapping each deployable.
- [x] Coolify: `infra/coolify/README.md` and `.env.staging.example`. Changesets configured.
- [x] Seeds authored and structurally validated; `pnpm db:reset` runs migrate + seed (live in CI and
      locally once Docker is available).

## Last session
- Date: 2026-10-10
- Done: Phase 0 built end to end and green. Packages: config, domain (100% coverage), contracts
  (+ OpenAPI 3.1 and Postman generation), i18n (parity gate), db (16 migrations with RLS, runner,
  client, seeds, Testcontainers isolation suite), integrations (interfaces + fakes), design-tokens,
  ui-web, ui-native. Apps: api (NestJS/Fastify with tenancy, context, problem+json, idempotency,
  outbox, audit, auth OTP/MFA/JWT, boots and serves at runtime), worker (outbox publisher + BullMQ),
  realtime (Socket.IO + Redis adapter), developers portal (Scalar), and the four web shells. Infra:
  docker-compose, two Docker templates, CI (quality + live-PostGIS database job), Coolify docs,
  Changesets. ADR-0014 recorded. Whole workspace: `pnpm lint`, `pnpm build` and 66 unit/property
  tests all pass. git initialised (no commits yet).
- Next: live staging on Coolify once a domain and VPS are available; run the DB suite locally when
  Docker is back; then Phase 1 (catalog and configuration).
- Blockers / questions:
  - Local Docker daemon is unresponsive here, so the PostGIS migrate and the isolation test were not
    run locally (SQL validated structurally; both run in CI against a live PostGIS service). To run
    locally: `docker compose -f infra/compose/docker-compose.yml up -d postgres` then
    `pnpm --filter @nxserve/db reset` and `pnpm --filter @nxserve/db test`.
  - Q25 (staging domain + DNS) and Q26 (VPS with Coolify + S3 backup) block only the live staging
    acceptance. Payments stay sandbox behind a flag until the Moyasar addendum (Q1, Q6).
