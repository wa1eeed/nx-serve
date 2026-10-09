# ADR-0005: Separate customer and provider apps built with Expo (React Native)

- Status: Accepted
- Date: 2026-10-09

## Decision
Two apps from one monorepo with shared packages. Expo for builds (EAS), OTA updates and
white-label builds per tenant.

## Consequences
One team for iOS/Android/web, server-driven configuration, OTA fixes. Native modules need EAS
builds. Background location only in provider app (store review).

## Alternatives considered
Native Swift/Kotlin (two teams, no sharing); single combined app (permissions and review risk).
