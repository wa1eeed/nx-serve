# ADR-0008: Public API conventions

- Status: Accepted
- Date: 2026-10-09

## Decision
REST `/v1`, snake_case JSON, UUIDv7 ids, cursor pagination, RFC 9457 errors with stable codes,
Idempotency-Key on POST, rate-limit headers, HMAC-signed webhooks, test/live keys, OAuth client
credentials. OpenAPI 3.1 generated from Zod contracts; Postman collection and SDK generated in CI.

## Consequences
Consistent developer experience, our apps use the same API, breaking changes caught by CI.
