# 11. API Platform and Developer Experience

The API is a first-class product, comparable to global infrastructure platforms. Our own apps use
the same API as third parties (dogfooding), so it is always complete and tested.

## 1. Audiences

1. Our apps and consoles (first-party clients).
2. Tenants extending their platform (ERP, CRM, accounting, insurer systems).
3. Third-party developers building integrations or apps (e.g. an insurer submitting tow requests,
   a fleet system syncing assets).

## 2. Surface

- Base: `https://api.<platform-domain>/v1` and tenant API domains (`api.<tenant-domain>`).
- Resources (initial): estimates, orders (+ stages, cancel, items, media, rating), customers,
  customer vehicles, providers, agents, assets, offerings, catalog (verticals, categories, tiers,
  fields, form schema), availability, vehicles catalog, payments (read), refunds (request),
  disputes, webhooks endpoints, events, files, reports.
- Admin-only resources are under the same versioning with stricter scopes.

## 3. Conventions

| Topic | Standard |
|---|---|
| Format | JSON, `snake_case`, UTF-8, ISO 8601 UTC timestamps, amounts as **integer minor units** + `currency` (ISO 4217). |
| IDs | UUIDv7 strings; human order reference (`TW-2026-000123`) per tenant. |
| Pagination | Cursor-based: `limit`, `starting_after`, `ending_before`; response `{ data, has_more, next_cursor }`. |
| Filtering/sorting | Documented query params per resource; `created[gte]` style ranges. |
| Expansion | `expand[]=provider` for related objects where useful. |
| Errors | RFC 9457 `application/problem+json` with `type`, `title`, `status`, `detail`, `code` (stable), `errors[]` (field), `request_id`. |
| Idempotency | `Idempotency-Key` header required on POST that creates or charges; 24 h replay. |
| Rate limits | Per key and per tenant (Redis token bucket); headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; 429 with `Retry-After`. |
| Versioning | URL major `/v1`; additive changes only within v1; deprecations announced with `Deprecation` and `Sunset` headers and changelog. |
| Localization | `Accept-Language: ar|en` for messages and labels. |
| Request tracing | `X-Request-Id` echoed; included in errors and logs. |

## 4. Authentication and authorization

- **Secret API keys** per tenant: `nx_test_...` and `nx_live_...`, shown once, hashed at rest,
  scoped (`orders:read`, `orders:write`, `providers:read`...), optional IP allow-list, rotation
  with overlap.
- **OAuth 2.0 client credentials** for server-to-server integrations; **authorization code + PKCE**
  later for third-party apps acting on behalf of tenants (marketplace phase).
- First-party apps use user JWTs (customer, agent, staff) with the same scope model.

## 5. Webhooks (outbound)

- Tenants subscribe endpoints to event types (`order.created`, `order.stage_changed`,
  `order.completed`, `payment.captured`, `payment.refunded`, `provider.approved`...).
- Signature header: `NX-Signature: t=<unix>,v1=<hex hmac_sha256(secret, t + "." + body)>`;
  tolerance 5 minutes; documented verification snippets in several languages.
- Delivery: at-least-once, exponential backoff for 72 h, idempotent event ids, delivery logs and
  manual replay in console, auto-disable after sustained failures with notification.

## 6. Sandbox

Test mode keys operate on isolated test data with Moyasar sandbox, simulated agents (bot that
accepts and advances stages), and test cards. Developers can trigger test events from the portal.

## 7. Developer portal (`apps/developers`)

- Guides (MDX): quickstart (first order in 5 minutes), authentication, idempotency, pagination,
  errors, webhooks, sandbox, tracking, pricing concepts, white-label concepts, going live.
- API reference rendered from OpenAPI (Scalar or Redoc), with try-it in sandbox.
- **Postman collection** and environment files generated from OpenAPI on every release and
  downloadable; "Run in Postman" button.
- SDKs: TypeScript first (`packages/sdk-js`), generated and published; others later.
- Changelog, status page link, support contact, rate limit table, error code catalogue.
- Bilingual (English first for developers, Arabic guides for local tenants).

## 8. CI pipeline for the API product

1. Build contracts > generate `openapi.json`.
2. Lint OpenAPI (Spectral ruleset: descriptions, examples, operationIds, error responses).
3. Breaking-change diff against last released spec (fail on break in v1).
4. Generate Postman collection, SDK, and portal build; publish on release.
5. Contract tests: API responses validated against spec in integration tests.
