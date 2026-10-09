# Docker images

One image per deployable, built from two multi-stage templates that use
`turbo prune --docker` so each image carries only what its scope needs. All run as the non-root
`node` user (docs/13).

## Node services (`Dockerfile.node`)

| Deployable | SCOPE | APP | Health |
|---|---|---|---|
| API | `@nxserve/api` | `api` | `GET /v1/health` (baked) |
| Realtime | `@nxserve/realtime` | `realtime` | TCP on REALTIME_PORT (override healthcheck) |
| Worker | `@nxserve/worker` | `worker` | none (disable healthcheck in the orchestrator) |

```bash
docker build -f infra/docker/Dockerfile.node --build-arg SCOPE=@nxserve/api --build-arg APP=api -t nxserve-api .
```

## Next.js apps (`Dockerfile.web`)

| Deployable | SCOPE | APP |
|---|---|---|
| Marketing | `@nxserve/marketing` | `marketing` |
| Platform admin | `@nxserve/web-platform-admin` | `web-platform-admin` |
| Tenant console | `@nxserve/web-console` | `web-console` |
| Storefront | `@nxserve/web-storefront` | `web-storefront` |
| Developers | `@nxserve/developers` | `developers` |

```bash
docker build -f infra/docker/Dockerfile.web --build-arg SCOPE=@nxserve/web-storefront --build-arg APP=web-storefront -t nxserve-web-storefront .
```

Mobile apps are built by EAS, not as server images. Migrations run as a separate one-off job
(`pnpm --filter @nxserve/db migrate`) before an API rollout, never on boot in production (docs/13).
