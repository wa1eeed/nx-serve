# ADR-0006: Transactional outbox, Redis/BullMQ and Socket.IO for realtime

- Status: Accepted
- Date: 2026-10-09

## Decision
Domain events written to an outbox in the same transaction; worker publishes to Redis channels,
WebSocket rooms, webhooks and notifications. Socket.IO with Redis adapter for horizontal scale.
High-frequency locations bypass the outbox (Redis GEO + batched persistence).

## Consequences
No lost or phantom events; at-least-once delivery requires idempotent consumers.
