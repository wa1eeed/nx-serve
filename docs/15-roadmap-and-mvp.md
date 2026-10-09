# 15. Roadmap, MVP Scope and Acceptance Criteria

Principle: the **structure is general from day one** (tenancy, configuration as data, events), but
**features are built in the order towing needs them**. The second vertical, launched with zero
code, is the proof that the engine works.

Capability blocks from docs/25 are part of the core: the stops model and payment plans are built
in Phase 1 to 4 with the order engine (not retrofitted later); business accounts in Phase 4 (data
model) and Phase 7 (billing UI); batching and route optimisation after Phase 8.

## Phase 0. Foundation
Scope: monorepo (pnpm + Turborepo), tooling, CI (lint, typecheck, test, build, OpenAPI checks,
image build), docker-compose, migrations from the reference schema with implementation rules
(docs/04), RLS + isolation test suite, auth (OTP, staff + MFA, JWT/refresh), tenancy resolution by
host and credential, outbox + worker publisher, audit log, idempotency middleware, error format,
OpenAPI generation, developer portal skeleton, i18n + RTL base, design system base, seeds, Coolify
staging deployment.
Acceptance:
- `pnpm i && pnpm dev` runs everything locally; `pnpm db:reset` seeds demo data.
- Isolation suite proves cross-tenant reads/writes fail for every tenant table.
- Staging reachable on Coolify with TLS, wildcard subdomain resolving a seeded tenant.
- OpenAPI, Postman collection and portal published from CI.

## Phase 1. Catalog and configuration
Verticals, categories, attribute definitions (all types incl. item_list and reference), item
catalogs, category requirements, workflows and stages, tiers, vehicle catalog (global + tenant
classes), cities/zones/availability, settings hierarchy, modules/plans/entitlements (basic),
roles/permissions, templates install (towing). Tenant console screens for all of it. Form schema
endpoint and renderers.
Acceptance: an admin configures towing entirely from the console; the form schema renders in web
and mobile; entitlement and permission checks enforced in API.

**Parallel track (starts in Phase 1): marketing site** (docs/22) with home, towing and logistics
use cases, pricing/waitlist, 5 guides, full SEO/AEO/GEO setup, so search visibility starts early.

## Phase 2. Providers
Onboarding journey, NX Verify adapter (fake + real interface), documents with expiry, Moyasar
merchant creation in sandbox + Nafath signing flow + status webhooks, per-category approval,
probation, agents, assets, offerings, presence, fleet portal basics.
Acceptance: a provider goes from signup to "eligible for dispatch" in sandbox.

## Phase 3. Pricing and fees
Rate cards + modifiers, zone surcharges, zone-to-zone fares, scheduled surge, estimates with maps
routing, fee engine, gateway fee mirror, maker-checker, simulator.
Acceptance: property tests for price and fee invariants; simulator matches engine output; worked
examples in docs reproduce exactly.

## Phase 4. Orders end-to-end (MVP complete)
Estimate > order > dispatch (auto nearest, broadcast, manual) > authorize with splits > stages with
proof > live tracking > capture > receipts; cancellations (void / partial capture), refunds,
disputes, ratings; **web storefront ordering (all plans) and provider PWA**, customer app and
provider app complete for towing; ops live map; reconciliation job; chargeback evidence pack;
Apple Pay domain registration per tenant domain.
Acceptance: full towing order in Moyasar sandbox on staging from the web (storefront + provider
PWA) and from both native apps, splits verified in
Moyasar dashboard; **trucking and courier templates launched by configuration only** (plus AC
maintenance as a non-transport check).

## Phase 5. Realtime and notifications hardening
Scale tests of WebSocket and location pipeline; notification templates editor; push/SMS/WhatsApp
providers with real credentials; delivery logs; fallback chains.

## Phase 6. API platform
Public `/v1` completeness for integrators, API keys and OAuth clients, scopes, webhooks
subscriptions with signing and replay, sandbox simulator bot, developer portal guides, SDK
publishing, rate limits.
Acceptance: an external developer completes the quickstart (first order in sandbox) using only the
portal.

## Phase 7. White-label commercial
Tenant self-signup wizard, plans/add-ons/overrides, licence billing with usage metering and ZATCA
invoices, provider memberships, custom domains with on-demand TLS, branded app build pipeline
(docs/20), "Powered by" and branding controls, template catalogue (moving, AC, cleaning, car wash,
consultation).
Acceptance: a new tenant signs up, installs a template, connects Moyasar sandbox, brands and builds
its apps, and completes an order without NX staff help.

## Phase 8. Hardening and production (SCCC)
Load tests, security review and penetration test, PDPL review, backups and DR drills, runbooks,
Terraform for Alibaba/SCCC, production go-live with NX towing brand.

## Phase 9. Passenger transport pack (gated)
Only after Phase 8 and after TGA requirements are verified (docs/16 Q24). Fast dispatch, rider
safety, rider and driver features, regulatory reporting (docs/25 section 6). Start with one niche.

## Out of MVP (backlog)
Quotes and negotiation UI, dynamic surge, corporate accounts on invoice, multi-stop routes,
recurring bookings, marketplace OAuth apps, in-person payments.
