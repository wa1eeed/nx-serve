# ADR-0001: TypeScript modular monolith (NestJS + Fastify) with separate realtime and worker deployables

- Status: Accepted
- Date: 2026-10-09

## Context
Small team, many domains (catalog, pricing, dispatch, payments, billing), need for speed and strong
boundaries, shared types with web and mobile.

## Decision
One TypeScript monorepo. API as a NestJS modular monolith; `realtime` and `worker` as separate
deployables sharing packages. Business logic in pure `packages/domain`.

## Consequences
Single language end to end, shared contracts, fast iteration. Module boundaries must be enforced
(lint rules on imports) to keep extraction possible later.

## Alternatives considered
Microservices from day one (operational overhead too high); Go/Java backend (loses type sharing
with apps).
