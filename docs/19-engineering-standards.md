# 19. Engineering Standards

## 1. Code

- TypeScript `strict`, no `any` (lint error), no non-null assertions without comment.
- Functional core, imperative shell: business rules in `packages/domain` as pure functions.
- Naming: files kebab-case, types PascalCase, functions camelCase, DB snake_case, API snake_case.
- Errors: typed domain errors mapped to problem+json codes; never leak internals.
- No magic numbers for business values: they are settings or configuration rows.
- Dates via a single library (Temporal polyfill or date-fns-tz); money via integer minor-unit helpers with currency exponent.
- Every module has a README: responsibility, public interface, events emitted/consumed, tables owned.

## 2. Testing pyramid

| Level | Tooling | Must cover |
|---|---|---|
| Unit | Vitest | Domain engines; 100% branch coverage for pricing, fees, splits, workflow, entitlements, settings. |
| Property | fast-check | Split sums, rounding, caps, bounds, monotonicity of pricing. |
| Integration | Vitest + Testcontainers | Repositories, RLS isolation, outbox, webhooks, Moyasar adapter against recorded sandbox fixtures. |
| Contract | OpenAPI validation | Every endpoint response matches spec. |
| E2E web | Playwright | Console configuration flows, approvals, simulator, storefront. |
| E2E mobile | Maestro | Customer order, provider acceptance, stages, tracking. |
| Load | k6 | Location ingestion, dispatch, order creation, WebSocket fan-out. |

Coverage gate: 85% overall, 100% branches in `packages/domain` money paths.

## 3. Git and releases

- Trunk-based with short-lived branches; PRs require green CI.
- Conventional Commits; Changesets for versioning packages and the public API changelog.
- Release tags trigger image builds, SDK/Postman/portal publishing, staging deploy.

## 4. Documentation as code

- Docs live with the code and change in the same PR.
- ADRs for significant decisions (`docs/adr/NNNN-title.md`).
- Runbooks for operations (`docs/runbooks/`).
- `docs/PROGRESS.md` updated at the end of each session: done, in progress, next, blockers.
- No em dashes in docs or copy (house style).

## 5. Performance and reliability

- N+1 queries forbidden (query logging in tests flags them).
- Timeouts, retries with jitter, and circuit breakers on every external call.
- Graceful shutdown for all services; idempotent jobs; dead-letter queues with alerts.

## 6. Accessibility and UX

- WCAG 2.1 AA for web; screen-reader labels in mobile; RTL mirrored layouts; Arabic typography
  tested; large touch targets for field agents (gloves, sunlight).
