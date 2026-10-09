# @nxserve/api

The modular monolith HTTP API (NestJS 11 on Fastify), versioned under `/v1` and used by our own
apps and third party developers alike (ADR-0001, docs/03, docs/11).

## Cross cutting infrastructure (Phase 0)

- **Request context** (`AsyncLocalStorage`): request id, locale, actor and tenant id flow through
  every layer. `X-Request-Id` is echoed on the response.
- **Tenancy**: a global guard resolves the tenant from the request host (and later the API
  credential) and sets it on the context; `@NoTenant()` opts a route out (health, token refresh).
- **Tenant scoped transactions**: `DbService.withTenant` opens a transaction and sets
  `app.tenant_id` via `SET LOCAL`, so PostgreSQL RLS scopes every query. The app connects as the non
  owner role; cross tenant lookups (host resolution) use the BYPASSRLS pool.
- **Errors**: a global filter renders every error as RFC 9457 `application/problem+json` with a
  stable `code` and the request id (`AppException`, `ZodError`, `DomainError`, `HttpException`).
- **Idempotency**: a global interceptor enforces `Idempotency-Key` on tenant POSTs and replays the
  stored response for a repeated key (`idempotency_keys`).
- **Outbox**: `OutboxService.emit` writes domain events in the request transaction (ADR-0006).
- **Audit**: staff mutations are recorded to `audit_logs`.
- **Auth**: phone OTP for customers and agents, staff email + argon2id password + mandatory TOTP
  MFA, short access JWTs (jose) and rotating refresh tokens with reuse detection.

## Endpoints (Phase 0)

`GET /v1/health`, `GET /v1/ready`, `GET /v1/app/bootstrap`, `GET /v1/me`, and
`POST /v1/auth/{otp/request,otp/verify,staff/login,mfa/verify,token/refresh,logout}`.

## Run

`pnpm --filter @nxserve/api dev` (needs Postgres and Redis from docker compose). `pnpm --filter
@nxserve/api build` compiles; `pnpm --filter @nxserve/api test` runs unit tests. External adapters
(payments, maps, notifications) are fakes in Phase 0; payments stay off behind a flag.
