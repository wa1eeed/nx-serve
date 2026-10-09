# 23. Tenant Storefront, Customer Account and Provider Portal

Each tenant's site (`apps/web-storefront`, resolved by host) is the **public face of its service
business**: service pages, ordering, customer login to "My account", and provider login to the
provider portal. It is not a page about the platform; NX branding appears only as "Powered by"
when the plan does not allow hiding it.

## 1. Storefront pages

| Page | Content |
|---|---|
| Home | Tenant hero, services grid (only services available in visitor's detected or chosen city), how it works, trust (ratings, licences), app download badges (Advanced plan) or "add to home screen", FAQ, CTA. |
| Service page | Per vertical/category: description, tiers with "from" prices, coverage cities, FAQ, start order. |
| Service x city page | Programmatic page generated only for active availability (e.g. "سطحة في الرياض"): local content blocks, zones covered, price examples, FAQ, LocalBusiness/Service schema. Thin-content guard: generated only when the tenant fills the minimum local content or approves an auto-draft. |
| Order flow | Uber-like flow (docs/09 P11), mobile-first, Moyasar web payment, live tracking page. |
| Become a provider | Benefits, requirements per category, membership plans, signup. |
| Legal | Terms, privacy (PDPL), cancellation policy, generated from templates and editable. |
| Blog / guides | Optional (Growth plan and above). |

Page builder: sections are configurable blocks (hero, services grid, banner, testimonials from
genuine ratings, FAQ, rich text, CTA) with ordering and per-locale content, rendered with the
tenant theme. No arbitrary HTML/JS injection except allow-listed tags in the SEO settings.

## 2. Tenant SEO, AEO and GEO settings (console > Website > Search)

| Setting | Plans |
|---|---|
| Site title, description, keywords per locale; per-page overrides (title, description, canonical, noindex) | All |
| Automatic sitemaps per domain, robots.txt, canonical handling when several domains | All |
| Structured data: Organization/LocalBusiness, Service, FAQPage, BreadcrumbList, AggregateRating (only from genuine verified order ratings) | All |
| OG images auto-generated with tenant brand | All |
| Search Console / Bing verification, GA4, GTM, Meta, Snap, TikTok pixels (consent-aware) | All |
| FAQ editor per service with AEO answer guidance (length hints, question phrasing tips) | All |
| Programmatic service x city pages | Growth and above |
| Redirect manager, 404 monitor, IndexNow | Growth and above |
| `llms.txt` per tenant (auto-generated, editable) and AI crawler policy | Growth and above |
| Blog with Article schema and authors | Growth and above |
| Custom head tags (allow-listed) | Advanced |

An **SEO health panel** scores each domain: indexability, missing metadata, duplicate titles,
Core Web Vitals (field data when available), structured data validation, broken links.

## 3. Customer portal: "My account" (حسابي)

Login by phone OTP from the storefront header. Sections:
- **Active orders** with live tracking, stage timeline, agent details (masked contact), cancel.
- **Order history** with reorder, receipts and e-invoices (PDF), rating.
- **My vehicles** (make, model, year, plate) and **saved addresses**.
- **Payment methods** (tokenized cards via Moyasar; we store tokens only).
- **Support**: disputes and tickets with status.
- **Notifications** preferences (push, SMS, WhatsApp, email), language.
- **Privacy**: download my data, delete my account (PDPL).
- Corporate accounts (later): multiple users, cost centres, monthly statements.

## 4. Provider portal (advanced dashboard)

Login by phone OTP (agents) or email + MFA (fleet managers). Role-aware.

| Area | Capabilities |
|---|---|
| Dashboard | Earnings (today, week, month), orders, acceptance and cancellation rates, rating, online hours, membership status, alerts (expiring documents, pending approvals). |
| Live operations | Map of own agents with status, active orders board by stage (kanban), assign/reassign within policy, chat with agents. |
| Orders | Search, filters, details with full timeline, proof media, GPS trail, disputes. |
| Team | Agents (invite, roles, performance), shifts and availability schedules. |
| Fleet | Assets with attributes, documents with expiry tracking and renewal uploads. |
| Services | Category applications and status, coverage zones, paid add-ons and prices, extra questions. |
| Finance | Earnings per order (gross, platform fee, gateway fee, net), Moyasar settlements reconciliation, membership dues and offsets, statements and invoices export. |
| Membership | Current plan, benefits, upgrade. |
| Reviews | Ratings received, replies (moderated). |
| Reports | Export CSV/XLSX, scheduled email reports. |
| Integrations | API keys for fleet systems (if tenant enables provider API access). |
| Settings | Org profile, bank details (via Moyasar flow), notification preferences, staff roles. |

The provider portal is the web console area for providers; field agents use the provider app or
its PWA export (docs/20).

## 5. Entry points

Storefront header: "Order now", "Login" (customer), "Partners" (provider portal). Dedicated hosts
are possible via `tenant_domains.purpose` (e.g. `partners.tenant.sa`).
