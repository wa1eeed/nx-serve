# ADR-0004: Moyasar Platform API with Authorization/Capture and Split Payments; never hold third-party funds

- Status: Accepted (contract terms pending, see docs/16)
- Date: 2026-10-09

## Decision
Each provider org is a Moyasar merchant. Orders are authorized (estimate + buffer) and captured at
completion with splits to provider and platform fee; fee_source configurable (platform or
provider). Partial capture for cancellation fees, void when nothing owed. No wallets or pooled
balances. Card data only in Moyasar components.

## Consequences
Compliant money flow without a SAMA licence; dependency on Moyasar enabling splits; careful
handling of authorization expiry and split rules.
