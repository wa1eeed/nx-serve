# ADR-0009: Staging on Coolify (own VPS), production on Alibaba Cloud via SCCC, same images

- Status: Accepted
- Date: 2026-10-09

## Decision
Staging on a VPS managed by Coolify with real PostgreSQL/PostGIS and Redis, production-identical.
Production in the SCCC Saudi region. Images built once in CI and promoted. Production data starts
clean with reference seeds; staging test data is never copied.

## Consequences
Low-cost realistic staging; must keep versions and env names aligned; verify SCCC service
availability (docs/16 Q18).
