# Reference schema

`reference-schema.sql` is the approved design produced during the design sessions. It loads cleanly
on PostgreSQL 16 + PostGIS 3 (94 tables) and is the source for the real migrations in
`packages/db/migrations`.

Do not run it in any environment. Convert it into versioned migrations applying the rules in
`docs/04-data-and-multitenancy.md` (UUIDv7, money as bigint halalas, tenant-scoped unique keys,
tenant_id in CREATE TABLE, FORCE RLS, audit/outbox/idempotency tables).
