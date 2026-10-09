# Staging on Coolify

Staging runs on our VPS via Coolify and must be production identical: same Docker images, same
Postgres 16 + PostGIS 3, Redis 7 and MinIO major versions, same migrations, same env variable names,
and the same reverse-proxy behaviour (wildcard subdomains plus custom domains). Only secrets and
scale differ (docs/13, ADR-0009).

## Services

| Service | Image / source | Notes |
|---|---|---|
| postgres | `postgis/postgis:16-3.4` | Managed by Coolify; scheduled backups to S3-compatible storage. Roles `nxserve_owner` (owner), `nxserve_app` (non-owner, RLS), `nxserve_superadmin` (BYPASSRLS). |
| redis | `redis:7-alpine` | BullMQ, Socket.IO adapter, GEO, rate limits, cache. |
| minio | `minio/minio` | S3-compatible object storage (OSS in production). Private buckets. |
| mailpit | `axllent/mailpit` | Dev/staging email capture. |
| api | `Dockerfile.node` (SCOPE `@nxserve/api`) | HTTP `/v1`. Migrations run as a one-off job before rollout. |
| realtime | `Dockerfile.node` (SCOPE `@nxserve/realtime`) | Socket.IO; websocket transport. |
| worker | `Dockerfile.node` (SCOPE `@nxserve/worker`) | BullMQ and outbox publisher; healthcheck disabled. |
| marketing, web-platform-admin, web-console, web-storefront, developers | `Dockerfile.web` | Next.js standalone. |

## Domains and TLS

- Wildcard `*.staging.<platform-domain>` for tenant subdomains, resolved to the storefront by host.
- App hosts: `api.staging...`, `ws.staging...`, `admin.staging...`, `console.staging...`,
  `developers.staging...`, `www.staging...`.
- TLS: a wildcard certificate via DNS challenge for subdomains, plus on-demand TLS for tenant custom
  domains. Coolify's Caddy proxy supports on-demand TLS with an `ask` endpoint that checks the host
  against `tenant_domains` before issuing a certificate (record the exact setup in an ADR when wired).

## Deploy flow

1. Merge to `main`; CI builds and tests, then pushes images tagged with the git SHA to the registry.
2. A deploy job runs `pnpm --filter @nxserve/db migrate` against staging (never on service boot).
3. Coolify redeploys the services to the new tag (webhook), then smoke tests run and notify.

Seeded with `nxserve` and `demo` tenants; a protected job runs `pnpm --filter @nxserve/db reset` to
reset staging. Reference and config data (templates, vehicle catalog, plans) move via migrations and
seeds, never by copying data between environments.

## Setup steps (first time)

1. Create the four infra services above; set the role passwords as secrets.
2. Create the database and roles (the first migration creates `nxserve_app` and `nxserve_superadmin`
   when the connecting role may create roles; otherwise a DBA pre-creates them).
3. Add the app resources from the Dockerfiles with the build args in `infra/docker/README.md`.
4. Set the environment from `infra/coolify/.env.staging.example` (names must match local and prod).
5. Configure the wildcard DNS record and certificate, and the custom-domain on-demand TLS ask
   endpoint.
6. Run the migrate job, then the seed job, then the smoke tests.

Blocked on: a staging domain with DNS control (docs/16 Q25) and the VPS with Coolify plus an
S3-compatible backup target (docs/16 Q26).
