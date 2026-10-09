# @nxserve/domain

Pure business logic with no IO. Everything here is deterministic and heavily tested; side effects
(database, gateways, queues) live in the application and integration layers.

## Responsibility

- **Money**: a single `Money` representation (integer `bigint` minor units plus an ISO 4217
  currency), arithmetic that refuses to mix currencies, scaling with explicit rounding, fare
  rounding rules per rate card, and `allocateMoney` which guarantees splits sum back to the total
  (the invariant behind payment splits). See ADR-0007 and docs/09.
- **Currency**: ISO 4217 exponents (SAR 2, several Gulf currencies 3). Adding a currency is one row.
- **IDs**: `uuidv7()` time ordered primary keys generated in the application (ADR-0007, docs/04).

Later phases add the pricing, fees, splits, workflow, dispatch scoring, entitlements and settings
engines here, all as pure functions.

## Public interface

Everything is exported from the package root (`@nxserve/domain`). Key symbols: `Money`, `money`,
`moneyFromMajor`, `addMoney`, `subMoney`, `sumMoney`, `scaleMoney`, `allocateMoney`,
`applyFareRounding`, `currencyExponent`, `minorPerMajor`, `uuidv7`, `isUuidv7`, and the typed
`DomainError` hierarchy.

## Events emitted / consumed

None. This package performs no IO.

## Tables owned

None.

## Tests

`pnpm --filter @nxserve/domain test`. Money paths require 100% branch coverage (docs/19); the
coverage gate is enforced in `vitest.config.ts`. Property tests (fast-check) assert that allocations
always balance.
