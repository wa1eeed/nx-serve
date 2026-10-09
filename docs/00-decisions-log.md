# 00. Decisions Log

Every decision taken during the design sessions with the founder (Waleed Al-Harbi, NX Solutions).
Status: **Approved** unless marked otherwise. Each line links to the doc that details it.

## Business and positioning

| # | Decision | Detail |
|---|---|---|
| B0 | Platform brand name: **NX Serve** (product of NX Solutions). The consumer towing brand run by NX as a tenant gets its own name (open). | docs/22 |
| B1 | The core product is a **configurable engine for field-service platforms**, sold as **white-label licences** to entrepreneurs and businesses. | docs/01 |
| B2 | NX runs its **own brand as a regular tenant** (`is_platform_owner = true`) on the same engine it sells. Towing is the first business and the live showcase. | docs/01, docs/10 |
| B3 | Towing is separated **in branding and go-to-market** (own brand, app, domain) but **not in code**. "Towing-first, not towing-only". | docs/01 |
| B4 | Revenue for NX: licence fees (flat, per provider, per order, % GMV or any mix). Revenue for tenants: per-order platform fees via Split Payments + optional provider memberships. | docs/10, docs/12 |
| B5 | Provider memberships must give real benefits (lower commission, dispatch priority, featured listing, badges, higher limits, faster payouts). | docs/12 |
| B6 | Customers are individuals first; corporate/insurer accounts paying on invoice are a planned capability. | docs/17 |

## Product and configuration

| # | Decision | Detail |
|---|---|---|
| P1 | Services (verticals), categories, fields, workflows, pricing, fees, dispatch, availability are **data**, editable in consoles. A new service needs zero code. | docs/02, docs/05 |
| P2 | Four **fulfillment modes**: at_customer, point_to_point, at_provider, remote. Three **tracking modes**: none, en_route, full_trip. Set per vertical, overridable per category. | docs/05 |
| P3 | **Configurable workflow stages** per service, each mapped to a core status. Per stage: tracking on/off, payment action, required proof (photos, OTP, signature, checklist), notifications, SLA. | docs/07 |
| P4 | **Order form = four layers**: (1) fixed core fields, (2) fulfillment fields, (3) service core fields defined by tenant admin, (4) provider content (paid add-ons, extra questions, field suggestions). Provider fields never affect pricing or matching. | docs/05 |
| P5 | `item_list` field type with admin-managed item catalogs (e.g. furniture pieces with size class and pricing units). Conditional visibility rules. Reference fields (e.g. vehicle). | docs/05 |
| P6 | Providers need **two approvals**: Moyasar merchant activation and **per-category approval** by the tenant. Probation (first N orders) before full dispatch priority. | docs/08 |
| P7 | Providers are **orgs** (freelancer, establishment, company) with **agents** and **assets**. A freelancer is an org with one agent. | docs/02, docs/08 |
| P8 | **Service templates** (towing, moving, AC, cleaning, consultation...) installable in one click by a tenant, then fully editable. | docs/10 |
| P9 | **Vehicle catalog** (makes, models, body types, weight, drivetrain) is global, maintained by NX. **Vehicle classes** (economy, luxury...) and model-to-class mapping are per tenant. | docs/05, docs/09 |
| P10 | Towing pricing has two dimensions: the **tier** the customer picks (standard flatbed, hydraulic, enclosed) and the **customer's vehicle class** which filters tiers and applies a multiplier. | docs/09 |
| P11 | Customer flow like Uber: service, vehicle, from/to, tier cards with price and ETA, confirm and authorize. Tier cards before locations only as "from X SAR". | docs/09 |
| P12 | Services shown are those available in the **pickup city** (detected by GPS against city polygons), with operating hours; intercity allowed per service. | docs/09 |

## Pricing and fees

| # | Decision | Detail |
|---|---|---|
| F1 | Pricing strategies per scope: fixed, formula (Uber-style), quote, negotiation. | docs/09 |
| F2 | Rate card fields: base fare, included km, per km, approach per km with free km, per minute, free wait + per wait minute, flat fare, minimum, maximum, booking fee, class multiplier, auth buffer %, re-price threshold %, rounding, cancellation fee and free minutes. Conditional modifiers. | docs/09 |
| F3 | Geography: zone surcharges, zone-to-zone fixed fares. Surge: scheduled (days, hours, seasons) and dynamic (demand/supply per zone) with **hard cap**, hold time, and **explicit customer acknowledgement**. Start with scheduled surge only. | docs/09 |
| F4 | Upfront pricing by default; authorize estimate + buffer; re-quote if actual route deviates beyond threshold. | docs/09 |
| F5 | **Fee engine**: schedules with components; bearer = customer, provider or platform; calc = percent, fixed, or both; min/max; base; VAT mode; refundable; visibility. Scoped by vertical, category, city, zone, provider. | docs/09 |
| F6 | Gateway (Moyasar) fee bearer is **platform or provider only**. A customer can only cover it indirectly through a flat service fee identical for all payment methods. | docs/06, docs/09 |
| F7 | Fee and rate changes require **maker-checker approval** (creator cannot approve), versioning and effective dates. Orders freeze a pricing snapshot. Admin **fee simulator** shows the full breakdown before approval. | docs/09 |

## Payments (Moyasar)

| # | Decision | Detail |
|---|---|---|
| M1 | Platform model: every provider org is an independent Moyasar merchant (entity) created via Platform API; settlement goes directly to the provider's bank account. | docs/06 |
| M2 | Order money flow: Authorization, then Capture at the completion stage, with **Split Payments**: provider split + platform (tenant) fee split. `fee_source` chooses who absorbs Moyasar's fee. | docs/06 |
| M3 | We never hold or pool third-party funds; no wallets. | docs/06 |
| M4 | Cancellation fees via partial capture; void only when nothing is owed (void reverses all splits). | docs/06 |
| M5 | Platform fee splits can be `refundable: false` when the policy says the fee is kept on refund. | docs/06 |
| M6 | Promo codes via **negative platform split** (platform funds the discount). | docs/06 |
| M7 | Contract with Moyasar is being negotiated: addendum must cover Split Payments activation, exclusion of split fees from the 70/30 pool (or reseller buy-rate model), clause 1.2 settlement directly to merchants, mutual non-circumvention, white-label display rights. Until signed, treat as open. | docs/16 |
| M8 | Each white-label tenant should connect **its own Moyasar platform account** (own_platform mode). Running tenants under NX's account (nx_master) only if Moyasar confirms a compliant recipient model (e.g. Beneficiary). | docs/06, docs/16 |
| M9 | In-person POS (NearPay SoftPOS) is **out of scope** for now: SoftPOS payments settle through the sponsoring acquirer, not Moyasar, so splits do not apply. | docs/17 |

## White-label and commercial

| # | Decision | Detail |
|---|---|---|
| W1 | Three levels: **NX super admin** manages tenants; **tenant admin** configures everything about their business (branding, services, pricing, fees, providers, memberships); **providers** manage their org. | docs/10 |
| W2 | Each tenant gets a default subdomain from its slug and can attach custom domains (DNS verification, automatic TLS), each with a purpose (website, admin, provider portal, api). | docs/10 |
| W3 | **Every tenant runs on the web from day one** (customer ordering on its storefront + provider web app as an installable PWA). **Branded store apps** (customer + provider) are an **Advanced plan** feature built from the tenant console via EAS, under the tenant's own Apple/Google accounts. There is **no shared NX container app**. | docs/10, docs/20 |
| W3b | Locked features are **visible to all tenants** with an "Advanced plan" tag and an upgrade call to action (upsell), never hidden. Applies to the Apps page and to every entitlement-gated feature. | docs/10 |
| W4 | **Modules**: service modules (towing, moving...) and capability modules (live tracking, quotes, negotiation, scheduling, b2b billing, branded apps, custom domain, public API, fleet portal) with dependencies. | docs/10 |
| W5 | **Plans** are versioned (grandfathering), contain modules + limits, can be public or private to a tenant group; **add-ons**; per-tenant **overrides** with reason and expiry. | docs/10 |
| W6 | **Licence billing** is a sum of price components: metric (flat, active providers, active agents, completed orders, GMV, cities, modules, app pairs, API calls, SMS) x model (flat, per unit, graduated, volume, package, percent), with included units, min/max, commitment, hard limits. | docs/12 |
| W7 | "Active provider" = provider with at least one completed order in the period (do not penalise registrations). | docs/12 |
| W8 | Tenant groups (resellers, enterprise, beta) for bulk settings and private plans. Reseller programme planned. | docs/10 |
| W9 | Hierarchical settings with locks and bounds (e.g. max customer service fee %, hide "Powered by NX" only on higher plans). | docs/10 |
| W10 | Roles and permissions per tenant (owner, ops manager, dispatcher, finance, support...) optionally scoped to a city or service. | docs/10 |

## Platform and engineering

| # | Decision | Detail |
|---|---|---|
| E1 | Web: super admin, tenant console + provider portal, public storefront per tenant with **full customer ordering, payment and live tracking** (MVP), provider web app (PWA), developer portal. | docs/03, ADR-0011 |
| E2 | Mobile: **separate** customer and provider apps, **Expo / React Native**, one monorepo. | ADR-0005 |
| E3 | Data is **realtime**: outbox events, WebSockets (Socket.IO + Redis), push notifications. | docs/14 |
| E4 | **Public API platform** with docs portal, OpenAPI, Postman collection, SDK, sandbox, webhooks, for third parties and tenants. | docs/11 |
| E5 | Staging on own **VPS with Coolify** and a real database, production-identical; production on **Alibaba Cloud via SCCC**, promoting the same images. | docs/13 |
| E7 | UI: **shadcn/ui + Tailwind** on web, **NativeWind + React Native Reusables** on mobile, one design-token source, runtime tenant theming, RTL-first. MUI, Ant Design, Chakra and DaisyUI evaluated and rejected. | docs/21, ADR-0012 |
| E8 | Platform marketing site (`apps/marketing`) sells licences; use cases start with towing and logistics; deep SEO, AEO and GEO; published early (Phase 1 parallel track). | docs/22 |
| E9 | Each tenant site = its service storefront + customer "My account" + provider portal entry, with its own SEO/AEO/GEO settings (basic on all plans, advanced on higher plans). | docs/23 |
| E10 | **Code is English** (identifiers, DB, API, errors, logs, docs, source catalog). Product ships **Arabic and English at full parity**, Arabic written natively. Global-ready via translatable JSON content, currency minor units, and country packs (Saudi first). | docs/24, ADR-0013 |
| E11 | Fonts: **IBM Plex Sans Arabic + IBM Plex Sans** default (Tajawal selectable). Type scales follow web best practice, iOS HIG and Material 3, with Arabic size and line-height adjustments. | docs/24 |
| P13 | **Capability blocks** in core: stops model (N stops), payment plans (authorize_capture, prepay, deposit_then_balance, milestones, invoice, reimbursable_purchase; cash_on_delivery disabled pending legal review), capacity matching, document generation and regulatory filings, business accounts, scheduling windows. Later: batching/route optimisation, cargo insurance, recurring orders. Restaurant/store marketplaces out of scope. | docs/25 |
| P14 | Seed templates: **towing, point-to-point trucking, courier delivery**, all configuration only. | docs/25 |
| P15 | **Template depth** is mandatory: tailored UX per template via configurable screen blocks, domain defaults, vertical KPIs, quality review before publishing. | docs/25 |
| P16 | **Passenger transport (ride-hailing style)** is a later, regulation-gated capability pack targeting niches (corporate, school, airport, intercity, medical, events, women drivers). Not marketed at launch; core designed to accept it. | docs/25 |
| E6 | NX Verify (our KYB/identity product) is used in provider and tenant onboarding before submission to Moyasar. | docs/08 |
