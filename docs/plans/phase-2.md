# Phase 2 Plan: Providers

Status: Draft for founder approval (2026-10-10). No application code until approved.
Source: docs/15 Phase 2, docs/08 (providers, onboarding, dispatch), docs/06 (payments, merchant
model), docs/18 (security, PDPL), docs/16 open questions Q1, Q3, Q5, Q6, Q8, Q9, docs/25, and the
current schema (migrations 0004, 0006, 0008, 0009, 0010, 0013) which already defines every provider
table.

## 1. Goal

A provider goes from signup to "eligible for dispatch" in sandbox, configurable and secure. We
implement the onboarding journey (identity and KYB via NX Verify, a Moyasar merchant created in
sandbox, Nafath signing, documents with expiry, per category approval with probation), agents,
assets, offerings and presence, plus a pure eligibility evaluator and the tenant admin provider
review screens. Everything sits behind the existing integration interfaces, so Moyasar stays one
replaceable gateway and no real credentials are needed yet (founder directive, Q1, Q6).

Acceptance (docs/15): a provider reaches "eligible for dispatch" in sandbox, proven end to end.

## 2. Scope

### In scope

- Domain engines (pure, no IO, property and branch tested) in `packages/domain`:
  - `providers/documents.ts`: resolve `category_requirements` (per `applies_to` org, agent, asset)
    against uploaded `provider_documents` into satisfied, missing, pending, expiring and expired
    sets, with a reference date for expiry.
  - `providers/onboarding.ts`: readiness resolver. From identity status, merchant status, document
    coverage and offering approvals, compute per step completion and the overall state
    (draft, verifying, documents_pending, under_review, needs_info, active, suspended), plus whether
    the org is eligible to be dispatched for a given offering.
  - `providers/eligibility.ts`: the eligibility evaluator (docs/08 section 3). Given an org, agent,
    asset, approved offering, valid documents, merchant status, tier `required_capabilities`, order
    `match_rule`s, group restriction and membership limits, return eligible with stable reason codes
    (for example `merchant_inactive`, `documents_expired`, `offering_not_approved`,
    `capability_mismatch`, `agent_offline`). Reuses `fields/validate` for capability matching.
  - Dispatch scoring is defined in docs/08 section 3 but is deferred to Phase 4 (it needs live
    orders and offers); only eligibility is built now, which is the Phase 2 acceptance line.

- Integrations (keep the fakes, wire the orchestration): the API drives onboarding through the
  existing interfaces without hard coding Moyasar:
  - `IdentityVerifier.startCheck({ subjectType: 'provider_org', legalName, cr?, iban? })` and
    `getCheck(ref)`, storing `nx_verify_ref` on `provider_orgs` and `provider_documents`.
  - `PaymentGateway.createMerchant({ entityType, legalName, iban })` and `getMerchant(id)`, storing
    `moyasar_merchant_id` and `moyasar_status` on `provider_orgs`. Splits remain inline per
    authorization (Phase 4); nothing is persisted at the gateway.
  - `NationalIdentity.requestSign({ nationalId, purpose })` and `getStatus(ref)` for the Nafath
    merchant signing step.
  - `StorageProvider` for document uploads (presigned URL, file ref stored, no bytes through our
    servers).
  - A merchant status webhook endpoint that verifies the signature with
    `PaymentGateway.verifyWebhook` (shared secret plus IP allowlist until Q9 is confirmed) and
    updates `moyasar_status` exactly once via `webhook_events`.
  - `createIntegrations(env)` selects real adapters later by env and a `PAYMENTS_ENABLED` flag;
    Phase 2 runs on fakes.

- API module `apps/api/src/providers` (new, modeled on `apps/api/src/catalog`), tenant scoped with
  RLS, idempotent POSTs, problem+json, audit and outbox events, contracts and OpenAPI:
  - Provider self service (actor type `agent`, authenticated by phone OTP, acting only on its own
    org, enforced by ownership checks plus RLS):
    - register an org (entity type, legal name, IBAN): start NX Verify, create the sandbox merchant,
      create the owner agent.
    - add agents and assets (asset attributes validated against `attribute_definitions` of scope
      `asset` or `provider_capability`), link agent to asset over time (`agent_assets`).
    - apply for offerings (vertical, category, zone, capabilities) into `provider_offerings`.
    - upload documents per `category_requirements` with expiry dates.
    - presence: go online or offline and send location heartbeats (Redis GEO hot state, batched
      persistence to `agent_presence`).
    - read own onboarding readiness and the per category document checklist.
  - Tenant admin (actor type `staff`, `@RequirePermission('providers.approve')`):
    - list provider orgs with onboarding status, review an offering (approve, needs_info, reject
      with reason notes), set probation, suspend or reactivate.
    - verify or reject documents, refresh or override merchant status.
    - provider groups create, update and membership (used later by dispatch policies).

- Entitlement limits: enforce `max_providers` and `max_agents` on creation via `EntitlementsService`
  (a new `limit_exceeded` problem). Provider admin endpoints gate on `providers.approve`; no new
  entitlement module is required (confirmed: none exists), but we add a `providers` capability module
  only if a later gating need appears, behind an ADR.

- Contracts: Zod schemas for every provider request and response, added to OpenAPI and Postman, plus
  new `KNOWN_EVENT_TYPES` (`provider.registered`, `agent.added`, `asset.added`, `offering.applied`,
  `offering.reviewed`, `document.uploaded`, `document.reviewed`, `merchant.status_changed`,
  `presence.changed`). Realtime rooms already fan out on `provider_org_id` and `agent_id`.

- Console (`apps/web-console`): a provider administration area, bilingual Arabic and English, RTL
  first, token driven: provider list with onboarding status, org detail (identity and merchant
  status, documents with verify and reject, offerings with approve, needs info and reject, probation
  and suspend), and provider groups. Built on the existing shared form and table patterns.

- Tests: domain property and branch tests for the three evaluators; an API e2e that runs the full
  onboarding to eligible for dispatch path plus authorization and cross tenant RLS, added to the CI
  database job (skips without a database, like the Phase 1 catalog e2e); RLS isolation covered for
  every new write.

### Out of scope (later phases)

- Dispatch execution: offer rounds, the Redis atomic claim, applying the scoring function, and the
  `dispatch_offers` lifecycle (Phase 4, orders end to end). The eligibility evaluator is built now;
  its use in live dispatch comes with orders.
- Provider memberships billing (`provider_plans`, `provider_subscriptions`, `provider_invoices`,
  `provider_dues_offsets`): Phase 7, white label commercial. Tables exist, not wired now.
- Real Moyasar, Nafath and NX Verify credentials, and the real webhook event list: go live, behind
  flags (Q1, Q6, Q9).
- Pricing and fees engine (Phase 3), customer ordering, authorization and capture with splits
  (Phase 4).
- The provider mobile app (`apps/provider-app`) full build: Phase 4 and 5. Phase 2 ships the
  configuration and API it will read, plus presence and offers endpoints it will call.

## 3. Build sequence

Each increment stays green (lint, build, tests), is committed, and is a good multi agent workflow
candidate (contracts, domain, API, tests fanned out).

1. Contracts and domain: provider Zod schemas and event types; the documents, onboarding and
   eligibility evaluators with property and branch tests.
2. Providers self service API: org register (NX Verify plus merchant create), agents, assets,
   offerings apply, documents upload, presence, and the readiness read. Outbox events.
3. Providers admin API: offering review and probation, document verify, merchant status refresh and
   the webhook, provider groups.
4. Entitlement limits (`max_providers`, `max_agents`) and the eligible for dispatch readiness
   endpoint.
5. Console provider administration screens.
6. E2E: onboarding to eligible happy path, authorization and RLS, in CI.

## 4. Risks and mitigations

- Payments and merchant model are unresolved (Q1, Q3, Q5, Q6): build fully against the fakes behind
  the `PaymentGateway` interface and the `PAYMENTS_ENABLED` flag, default `own_platform`, splits
  inline per authorization in Phase 4. No hard Moyasar dependency anywhere.
- Webhook security (Q9): verify by shared secret plus IP allowlist until confirmed, process exactly
  once via `webhook_events`.
- Provider self service authorization: an `agent` actor may act only on its own org; enforce org
  ownership on every self service write in addition to RLS, so one provider can never touch another.
  Admin actions require `providers.approve`.
- Document storage and PII (PDPL, docs/18): store only file references through `StorageProvider`
  (KSA residency in production), keep PII minimal, and mask provider to customer contact later.
- Capability validation: reuse `fields/validate` so asset attributes and offering capabilities
  validate against the tenant `attribute_definitions`, keeping the engine generic (no towing
  specific code).
- Schema is already complete: no new tables are expected. If a genuine gap appears, write an ADR and
  a migration rather than drifting.

## 5. Acceptance tests

- Happy path (API e2e, CI): a freelancer registers by OTP, NX Verify returns verified, a sandbox
  Moyasar merchant is created and becomes active, an owner agent and an asset are created, an
  offering is applied for towing, light vehicles and a Riyadh zone, the required documents
  (vehicle registration, operating permit) are uploaded, the tenant admin approves the offering, the
  readiness endpoint reports eligible for dispatch, and the eligibility evaluator returns eligible
  for a matching order and tier.
- Authorization: provider self service is blocked across orgs; admin endpoints require
  `providers.approve`; anonymous is blocked.
- Tenant isolation (RLS): tenant A cannot read or write tenant B providers, offerings or documents
  through the endpoints.
- Limits: creating providers or agents beyond `max_providers` or `max_agents` returns a limit error.
- Events and webhooks: writes emit domain events through the outbox; a duplicate merchant webhook is
  processed exactly once.

## 6. Definition of done (CLAUDE.md section 5.3)

Typed contracts and OpenAPI with examples; unit and integration tests, RLS isolation covered, the
evaluators property tested; migrations reversible where applicable (none expected); i18n Arabic and
English with RTL verified in the console; audit log for admin actions and domain events via the
outbox; docs updated (module README, docs/08 if the design changes, PROGRESS.md); runs in
docker compose and the CI database job.
