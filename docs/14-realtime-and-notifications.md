# 14. Realtime and Notifications

Realtime is part of the core from Phase 0 (outbox + event bus). WebSocket features ship with the
orders phase. Push notification **providers and credentials** are configured after the core build,
but the notification pipeline, templates and in-app/console channels are built early with a log
provider so nothing needs refactoring later.

## 1. WebSocket gateway (`apps/realtime`)

- Socket.IO, authenticated by the same JWT/API credentials; tenant bound at connection.
- Rooms: `tenant:{id}:ops`, `tenant:{id}:zone:{zone}`, `order:{id}`, `agent:{id}`,
  `provider_org:{id}`, `customer:{id}`.
- Server events: `order.updated`, `order.stage_changed`, `order.location` (only while
  `tracking_active`), `dispatch.offer` (to agent, with countdown), `dispatch.offer_cancelled`,
  `presence.updated` (ops map), `price.surge_changed` (zone).
- Client events: `agent.location` (batched points), `agent.status` (online/offline/busy),
  `offer.accept` / `offer.decline` (also available via HTTP for reliability).
- Scale-out: Redis adapter; stateless nodes; backpressure and rate limits per socket.
- Fallback: apps reconcile state via HTTP on reconnect (never rely on missed socket events).

## 2. Location pipeline

Agent app > `agent.location` (every 3 to 5 s, adaptive) > realtime node validates and writes Redis
GEO + last position hash > publishes to `order:{id}` room if a tracking stage is active > worker
persists batches to `tracking_points` and updates `agent_presence` every N seconds.

ETA recomputation: on significant movement or every 30 s via `MapsProvider`, throttled per order.

## 3. Notifications

- Channels: push, SMS, WhatsApp, email, in-app inbox, console toast.
- `notification_templates` per tenant, event, channel, locale with variables
  (`{{order.ref}}`, `{{agent.name}}`, `{{eta}}`).
- Routing per stage `notify` config and user preferences; quiet hours; dedup.
- Providers: Expo Push (or direct FCM/APNs) with per-app credentials for branded apps; **Web Push
  (VAPID) for the storefront and provider PWA** (all plans); SMS through
  a Saudi provider (registered sender names required); WhatsApp Business via an approved provider.
- Delivery logs with status; retries; fallback chain (push failed > SMS for critical events such
  as "agent arrived").

## 4. Ops live map

Console map of agents (status colours), active orders with stage, SLA breaches, surge heatmap per
zone, filters by vertical, group and city. Updates via `tenant:{id}:ops` room.
