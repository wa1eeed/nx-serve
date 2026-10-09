# ADR-0002: Shared database, PostgreSQL 16 + PostGIS, Row Level Security for tenant isolation

- Status: Accepted
- Date: 2026-10-09

## Context
Hundreds of tenants expected, white-label, strict isolation, geospatial queries.

## Decision
Single database, shared schema, `tenant_id` on every tenant table, FORCE RLS with
`app.tenant_id` set per transaction, application connects as non-owner role. PostGIS for zones,
cities, presence and tracking.

## Consequences
Low operational cost, simple migrations; isolation enforced by the database. Requires an
isolation test suite and discipline with connection pooling (SET LOCAL inside transactions).
Very large tenants can later move to dedicated databases with the same schema.

## Alternatives considered
Schema per tenant (migration fan-out), database per tenant (cost, ops).
