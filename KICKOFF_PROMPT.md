# Kickoff prompt for Claude Code

Open Claude Code in the root of this folder (`nx-serve`) and paste everything between the lines.

---

You are the founding engineering team of **NX Serve**. This folder contains the complete,
approved design of the platform. Your first job is to understand it fully before writing any code.

## Step 1. Read everything, in this exact order, without skipping or skimming

1. `CLAUDE.md` (master instructions; it overrides any other document)
2. `README.md`
3. `docs/00-decisions-log.md` (every approved decision)
4. `docs/01-product-and-business-model.md`
5. `docs/02-domain-model.md`
6. `docs/03-architecture.md`
7. `docs/04-data-and-multitenancy.md`
8. `docs/05-services-fields-and-fulfillment.md`
9. `docs/06-payments-moyasar.md`
10. `docs/07-orders-and-workflows.md`
11. `docs/08-providers-onboarding-and-dispatch.md`
12. `docs/09-pricing-and-fees.md`
13. `docs/10-white-label-tenancy-and-entitlements.md`
14. `docs/11-api-platform.md`
15. `docs/12-billing-licences-and-memberships.md`
16. `docs/13-infrastructure-and-deployment.md`
17. `docs/14-realtime-and-notifications.md`
18. `docs/15-roadmap-and-mvp.md`
19. `docs/16-open-questions.md`
20. `docs/17-backlog-proposals.md`
21. `docs/18-security-and-compliance.md`
22. `docs/19-engineering-standards.md`
23. `docs/20-tenant-app-launch.md`
24. `docs/21-design-system-and-ui.md`
25. `docs/22-marketing-site-seo-aeo-geo.md`
26. `docs/23-tenant-storefront-account-and-provider-portal.md`
27. `docs/24-internationalization-and-typography.md`
27b. `docs/25-capability-blocks-and-vertical-templates.md`
28. Every ADR in `docs/adr/` (0000 to 0013)
29. `docs/PROGRESS.md`, `docs/plans/README.md`, `docs/runbooks/README.md`
30. `database/README.md`, then `database/reference-schema.sql` in full (all 13 sections)
31. `reference/private/moyasar/README.md`, then both PDFs in that folder, page by page (read them
    in page ranges; the agreement is about 15 pages and the API deck about 27 pages)
32. The custom commands in `.claude/commands/`
33. The live Moyasar Platform docs linked in `docs/06` (Managing merchants, Define fees, Documents,
    Nafath signing, Webhooks, Payment Splitting, Apple Pay domains), if you have web access

If a file cannot be read, tell me which one instead of guessing its content.

## Step 2. Prove your understanding (reply in Arabic, then stop and wait)

1. **Files read**: a checklist of every file above with a one-line summary of each.
2. **Understanding summary** (one to two pages), covering at least:
   - what NX Serve is, who pays whom, and how money flows through Moyasar (authorize, capture,
     splits, fee source, partial capture, void, refunds) without us ever holding third-party funds
   - the three control levels (NX super admin, tenant, provider) and what each configures
   - how a new service is launched by configuration only (fulfillment modes, tracking modes,
     workflow stages, dynamic fields, tiers, rate cards, fees, dispatch, availability)
   - towing pricing (rate card fields, vehicle class, zones, surge) with the worked example
     recalculated by you
   - white-label: domains, web for all plans, branded apps on the Advanced plan, modules, plans,
     entitlements, locked-feature pattern, licence billing, provider memberships
   - API platform, developer portal, Postman, SDK, webhooks
   - realtime design, notifications, environments (local, Coolify staging, SCCC production)
   - the marketing site and each tenant's storefront, "My account" and provider portal
   - language policy (English code, Arabic and English at parity, native Arabic quality), country
     packs, fonts and type scales
   - capability blocks (stops, payment plans, capacity matching, documents, business accounts)
     and how towing, trucking and courier run as templates on the same code, template depth, and
     how the core stays ready for the later passenger transport pack
3. **Contradictions, gaps and risks** you found across the documents, each with a proposed
   resolution. Add them to `docs/17-backlog-proposals.md` (and to `docs/16-open-questions.md` if
   they need a business decision).
4. **Questions for me** that block Phase 0 (only real blockers; decide everything else yourself
   and document it).
5. **Phase 0 plan**: run `/phase-plan 0` to write `docs/plans/phase-0.md` with tasks in order,
   acceptance tests, and the exact repository layout you will create.

Do not write application code until I approve the Phase 0 plan.

## Step 3. After my approval

Implement Phase 0 end to end following `CLAUDE.md`: monorepo and tooling, CI, docker-compose,
SQL migrations with RLS converted from the reference schema (with the implementation rules in
`docs/04`), isolation test suite, auth, tenancy resolution, outbox, audit and idempotency,
OpenAPI pipeline with Postman and developer portal skeleton, i18n and RTL base, design tokens and
UI packages, seed data, and the Coolify staging setup documented in `infra/coolify/README.md`.

Rules for the whole project:
- Work like a senior team at a top technology company: strict types, tests first for domain
  logic, clean module boundaries, no shortcuts on tenancy isolation, security or money handling.
- Keep documentation current in the same change as the code. New significant decisions become
  ADRs (`/adr`). End every session with `/session-wrap`.
- Propose anything missing that a professional platform needs, and build what is clearly required.
- Never assume answers to items in `docs/16-open-questions.md`; build behind interfaces or flags.
- No em dashes in any documentation, UI copy or commit message.
- Talk to me in Arabic; code, comments and documentation in English.

---
