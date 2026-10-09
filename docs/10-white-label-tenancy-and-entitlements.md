# 10. White-Label, Tenancy and Entitlements

## 1. Three levels of control

| Level | Console | Controls |
|---|---|---|
| NX super admin | `web-platform-admin` | Tenants, groups, plans, modules, add-ons, overrides, licence billing, global catalogs (vehicles, templates, cities), setting definitions and platform defaults/locks, monitoring, impersonation (audited). |
| Tenant admin | `web-console` | Branding, domains, apps, payment gateway connection, services (from templates), fields, workflows, tiers, pricing, fees, dispatch, availability, providers and approvals, provider memberships, customers, staff roles, notifications, API keys and webhooks, reports. |
| Provider | `web-console` (provider area) + provider app | Org profile, agents, assets, documents, offerings applications, add-ons, membership, earnings and settlements. |

## 2. Tenant lifecycle

Signup (slug, legal details) > NX Verify KYB > plan selection / trial > template install >
branding > Moyasar connection (sandbox first) > provider onboarding > go live checklist > live.
Suspension and cancellation flows keep data per retention policy and allow export.

## 3. Domains

- Default: `<slug>.<platform-domain>` (wildcard DNS + wildcard TLS).
- Custom domains: DNS TXT verification, automatic TLS (on-demand issuance with an allow-list check
  endpoint), purpose per hostname (website, admin, provider_portal, api), one primary.

## 4. Branding

Logo, colors, typography, favicon, app icon/splash, email templates, notification sender names,
legal pages, "Powered by NX" visibility (setting, locked on lower plans). Design tokens drive both
web (CSS variables) and mobile (theme provider).

## 5. Apps per tenant

| Mode | Description |
|---|---|
| web (all plans) | Customers order on the tenant's storefront; providers and agents use the provider web app (installable PWA). Branded at runtime from tenant settings. |
| branded (Advanced plan) | Separate customer and provider store apps under the tenant's name and developer accounts. |

The Apps page is visible to every tenant. Without the `branded_apps` module it shows an
"Advanced plan" tag, a preview of what the apps would look like with the tenant's branding, and an
upgrade button. There is no shared NX container app.

Branded build flow from the tenant console: upload assets, set names and bundle ids, connect
Apple/Google credentials, press Build. The worker triggers EAS Build with tenant config (app config
generated from DB), tracks `app_builds`, and submits to stores. Over-the-air updates via EAS Update
channels per tenant. Constraints: Apple guideline on duplicate apps requires publishing under the
tenant's own account; store review is outside our control.

## 6. Modules, plans, entitlements

- **Modules**: `service` (towing, moving, ac_service...) linked to a template; `capability`
  (live_tracking, quotes, negotiation, scheduling, b2b_billing, branded_apps, custom_domain,
  public_api, fleet_portal, dynamic_surge, provider_memberships...). Dependencies (hard or soft).
- **Plans** with versions (grandfathering), modules, limits (max services, providers, agents,
  cities, admin users, orders/month, API calls/day, branded app pairs), visibility (public, group).
- **Add-ons** and **overrides** (reason, expiry, creator).
- Effective entitlements computed by `packages/domain/entitlements`, cached, and enforced in API
  guards and in UI.
- **Locked state UX (all gated features)**: features the tenant is not entitled to are shown, not
  hidden, with a plan tag (e.g. "Advanced plan"), a short value description, and an upgrade CTA
  that opens the plan comparison and upgrade flow. API calls to locked features return
  `403` problem+json with code `entitlement_required` and the required plan/module.

## 7. Groups, roles, permissions

- Tenant groups: resellers, enterprise, beta, government; bulk settings and private plans.
- Roles: system templates (owner, ops_manager, dispatcher, finance, support, developer) + custom
  roles per tenant; assignment optionally scoped to a city or vertical.
- Permissions are fine-grained codes (`orders.dispatch`, `pricing.approve`...), shown only when the
  related module is entitled.

## 8. Hierarchical settings

`setting_definitions` (key, type, default, editable levels, required module) and `setting_values`
per level (platform, plan, tenant_group, tenant, provider) with `is_locked` and min/max bounds.
Resolution: lowest level allowed and not locked above wins, clamped to bounds. Examples:
`fees.max_customer_service_fee_pct`, `dispatch.offer_timeout_sec`, `branding.hide_powered_by`,
`providers.show_customer_phone`, `orders.require_otp_on_completion`.

## 9. Templates

`service_templates` payload bundles a complete vertical (categories, fields, item catalogs,
workflow, tiers, pricing, fees, dispatch, requirements, notification texts). Install creates an
editable tenant copy (`tenant_template_installs`). NX template upgrades are offered as diffs.

Initial templates: towing, moving, AC maintenance, home cleaning, mobile car wash, consultation.

## 10. Golden rule

No tenant-specific code. Valuable requests become generic settings or modules.
