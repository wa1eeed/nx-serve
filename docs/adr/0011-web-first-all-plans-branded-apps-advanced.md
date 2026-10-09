# ADR-0011: Web for all plans, branded store apps on the Advanced plan, no shared container app

- Status: Accepted
- Date: 2026-10-09

## Context
Tenants need to operate from day one without store accounts or reviews. A shared NX container app
would mix tenants' customers in one store listing and weaken each tenant's brand.

## Decision
- All plans: customers order, pay and track on the tenant's web storefront (Next.js, mobile-first);
  providers and agents use the provider app **exported to the web as an installable PWA** via Expo
  web, so one codebase serves native and web.
- Advanced plan: branded customer and provider store apps (docs/20).
- No shared NX container app.
- Every entitlement-gated feature is shown locked with a plan tag and upgrade CTA.

## Consequences
Faster tenant launch and a clear upgrade path. Web limitations (background location, iOS web push
only for installed PWAs) are mitigated with wake lock, SMS fallback and longer offer timeouts, and
documented to tenants. Storefront ordering moves into the MVP.

## Alternatives considered
Shared container app (brand dilution, store policy risk); web for customers only (providers would
need store apps on every plan).
