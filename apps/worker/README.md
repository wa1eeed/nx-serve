# @nxserve/worker

Background processing (BullMQ) and the transactional outbox publisher (ADR-0006, docs/14).

## Responsibility

- **Outbox publisher**: drains `outbox_events` (FOR UPDATE SKIP LOCKED, BYPASSRLS pool so it spans
  tenants) and publishes each event to Redis (`nx:events`) with its target rooms, for the realtime
  gateway and, later, webhook delivery and notifications. At least once; consumers are idempotent by
  event id. Marks `published_at` and increments `attempts`.
- **Queues**: `webhooks`, `notifications`, `maintenance` workers are wired as skeletons. The dispatch
  rounds, auth expiry guard, webhook delivery, notifications, billing and reconciliation jobs are
  built in their phases (docs/15).

## Run

`pnpm --filter @nxserve/worker dev` (needs Redis and Postgres). Graceful shutdown drains in-flight
work on SIGTERM/SIGINT. `pnpm --filter @nxserve/worker test` runs unit tests.
