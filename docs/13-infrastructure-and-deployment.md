# 13. Infrastructure and Deployment

## 1. Principles

- **Twelve-factor**: config only via environment variables; stateless containers; logs to stdout.
- **Build once, promote everywhere**: the same image tag runs in staging and production.
- **Staging = production** in versions, topology (as far as possible), migrations, env names,
  proxy behaviour. Only secrets, scale and data differ.
- **Infrastructure as code** for production; documented, reproducible setup for staging.

## 2. Deployables

| Image | Notes |
|---|---|
| `api` | NestJS; runs migrations as a separate one-off job before rollout (never on boot in prod). |
| `realtime` | Socket.IO; sticky sessions not required with Redis adapter + websocket transport. |
| `worker` | BullMQ; scalable by queue. |
| `web-platform-admin`, `web-console`, `web-storefront`, `developers` | Next.js standalone output. |
| mobile apps | Built by EAS, not deployed to servers. |

Dockerfiles: multi-stage, pnpm fetch + turbo prune, non-root user, `HEALTHCHECK`, minimal base
(node:22-alpine or distroless), SBOM generation, image scanning in CI.

## 3. Local

`infra/compose/docker-compose.yml`: `postgis/postgis:16-3.4`, `redis:7`, `minio`, `mailpit`, and
optionally the apps. `pnpm dev` runs apps with hot reload against these services.
`pnpm db:reset` migrates and seeds.

## 4. Staging on Coolify (own VPS)

- Coolify manages: PostgreSQL 16 + PostGIS (same image as local), Redis 7, MinIO, and each app
  from the Git repository (Dockerfile build) or from images pushed by CI to a registry.
- Domains: wildcard `*.staging.<platform-domain>` for tenant subdomains; app hosts
  `api.staging...`, `ws.staging...`, `admin.staging...`, `console.staging...`,
  `developers.staging...`. Custom-domain flow tested with a real test domain.
- TLS: wildcard certificate via DNS challenge; on-demand TLS for custom domains (Caddy proxy in
  Coolify supports on-demand TLS with an `ask` endpoint; document the choice in an ADR).
- Backups: Coolify scheduled PostgreSQL backups to S3-compatible storage + weekly restore test.
- Deploy flow: merge to `main` > CI builds and tests > pushes images tagged with git SHA > deploy
  job runs migrations > Coolify redeploys services (webhook) > smoke tests > notify.
- Seeded with demo tenants; resettable by a protected job.
- `infra/coolify/README.md` documents every service, env var, domain and the exact setup steps.

## 5. Production on Alibaba Cloud via SCCC (Saudi region)

Target mapping (verify each service's availability and versions in the SCCC region before
committing; record findings in an ADR):

| Need | Service |
|---|---|
| Containers | ACK (managed Kubernetes) or ECS instances with Docker; start with what the team can operate |
| Registry | Container Registry (ACR) |
| PostgreSQL + PostGIS | ApsaraDB RDS for PostgreSQL 16 with PostGIS extension, HA, PITR |
| Redis | ApsaraDB for Redis / Tair |
| Object storage | OSS (S3-compatible API through our StorageProvider) |
| Load balancing / TLS | ALB/SLB + certificate service; on-demand TLS for custom domains via a Caddy edge or ALB certificate automation |
| Secrets | KMS / Secrets Manager |
| Logs / metrics | Log Service (SLS), CloudMonitor, or self-hosted Grafana stack fed by OpenTelemetry |
| WAF / DDoS | WAF + Anti-DDoS basic |

Terraform in `infra/alibaba/` (later phase). Data residency in KSA satisfies PDPL expectations for
production.

## 6. Promotion from staging to production

1. Staging stable: all E2E suites green, load test passed, security checklist done.
2. Tag a release; the same image digests are deployed to production.
3. Production database is created fresh: migrations + **reference/config seeds only** (templates,
   vehicle catalog, plans, modules, permissions, setting definitions). Staging test data is never
   copied. If a real pilot ran on staging, migrate those specific tenants with a reviewed script.
4. Switch DNS, monitor, keep staging as pre-production for the next releases.

## 7. Operations

- Runbooks in `docs/runbooks/`: deploy, rollback, migration failure, Moyasar outage, Redis
  failure, stuck dispatch queue, webhook backlog, restore from backup, incident response.
- SLOs: API availability 99.9%, p95 latency targets (docs/03), dispatch time, location freshness.
- Alerts on SLO burn, queue depth, auth-expiry risk, failed captures, webhook failures,
  reconciliation mismatches.
