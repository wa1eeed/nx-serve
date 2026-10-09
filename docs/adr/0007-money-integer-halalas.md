# ADR-0007: Money as integer minor units (halalas for SAR)

- Status: Accepted
- Date: 2026-10-09

## Decision
All monetary amounts are `bigint` minor units in DB, integers in code and API, always with a
currency code (ISO 4217 exponent: SAR 2 = halalas, matching Moyasar; KWD/BHD/OMR 3).
Fractional rates stay numeric; conversions round explicitly (documented rule per calculation).

## Consequences
No floating point errors; reference schema numeric columns are converted during migration.
