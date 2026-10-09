# 16. Open Questions (do not assume answers)

Build around these behind interfaces, settings or feature flags. Update this file when resolved
and record the outcome in `00-decisions-log.md`.

## Moyasar (blocking for live payments)

| # | Question | Impact | Fallback while open |
|---|---|---|---|
| Q1 | Will Split Payments be enabled for our platform, and is our contract on the aggregation model? | Core revenue model. | Build splits fully against sandbox; feature flag. |
| Q2 | Are platform split amounts excluded from the 70/30 revenue share, or will we move to a reseller buy-rate model? | Margins, fee engine defaults. | Fee engine supports both. |
| Q3 | Can splits be set or modified at capture (authorize under platform before provider is known)? Partial capture split allocation? | When to authorize. | Authorize after assignment with card token. |
| Q4 | Maximum authorization validity period. | Long jobs, scheduled orders. | Auth-expiry guard; re-authorize; deposit model for scheduled jobs. |
| Q5 | Can white-label tenants operate under NX's platform (Beneficiary recipient), or must each sign its own platform agreement? | White-label onboarding. | Default `own_platform`. |
| Q6 | Clause 1.2: confirm settlement goes directly to merchants, not via NX. | Regulatory (no third-party funds). | Assume direct settlement only. |
| Q7 | Referral fee inconsistency (1 SAR vs 100 SAR per merchant). | Commercial. | None needed in code. |
| Q8 | Which features are available to platform merchants: payment links, recurring/tokenization, invoices, Apple Pay in React Native apps, STC Pay? | Customer UX. | Adapter capabilities flags. |
| Q9 | Webhook signature mechanism and event list for Platform API. | Security. | Verify by secret token + IP allow-list until confirmed. |
| Q10 | White-label display: may we show the gateway as our checkout with "Powered by Moyasar"? | Branding. | Show "Powered by Moyasar". |
| Q10b | Apple Pay on the web for many tenant domains: limits and process of the Apple Pay domains registration API per platform/merchant. | Web checkout UX. | Card form only until confirmed. |

## Business and legal

| # | Question |
|---|---|
| Q11 | Commercial registration activities covering online platforms and software licensing. |
| Q12 | TGA licensing requirements for towing operators and documents to require. |
| Q13 | Legal review of terms: customer, provider, tenant licence agreement, provider membership offsets consent. |
| Q14 | VAT treatment of platform fees vs provider service amounts (who invoices whom) per tenant model. |
| Q15 | Surge pricing acceptability for emergency towing (caps, disclosure). |
| Q16 | Platform brand is **NX Serve** (decided). Open: platform domain, trademark registration check (SAIP), and the consumer brand name for NX's own towing tenant. |

## Technical

| # | Question |
|---|---|
| Q17 | Maps provider contract (Google Maps Platform pricing at expected volumes) vs alternatives. |
| Q18 | SCCC availability of RDS PostgreSQL 16 + PostGIS, managed Redis version, ACK. |
| Q19 | SMS and WhatsApp providers and sender registration. |
| Q20 | ZATCA integration: certified provider vs in-house Phase 2 implementation. |
| Q21 | TGA electronic waybill requirement for land freight: scope, integration method, and which tenants it applies to. |
| Q22 | Delivery activity regulation: courier registration and app licensing requirements for courier templates. |
| Q24 | Passenger transport via apps: TGA operator licence, driver eligibility and localisation, vehicle rules, trip data reporting, and whether a white-label tenant can operate under its own licence on our platform. |
| Q23 | Cash on delivery: is it allowed for tenants/agents to collect cash for third parties, and under what controls? |

## Infrastructure access (raised during the Phase 0 kickoff review, 2026-10-09)

| # | Question | Why it blocks Phase 0 |
|---|---|---|
| Q25 | A confirmed staging domain with DNS control (ideally the final platform domain, otherwise a temporary staging domain). | The wildcard subdomain model, cookie and email sender domains, Apple Pay domain registration and the seed tenant slugs all need it. The Phase 0 acceptance item "wildcard subdomain resolving a seeded tenant with TLS" cannot be met without it. Relates to Q16. |
| Q26 | Access to a VPS with Coolify plus an S3 compatible backup target. | The "staging reachable on Coolify" acceptance item depends on real infrastructure. Without it, Phase 0 completes locally and in CI and documents the Coolify setup, deferring the live staging check. |
