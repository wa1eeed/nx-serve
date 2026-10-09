# ADR-0003: Services are configuration, not code

- Status: Accepted
- Date: 2026-10-09

## Decision
Verticals, categories, fields, workflows, tiers, pricing, fees, dispatch and availability are
data. Engines act on core statuses and flags. No tenant-specific code.

## Consequences
New services and tenants without releases; engines must be generic and well tested; a missing
capability is built once for everyone.
