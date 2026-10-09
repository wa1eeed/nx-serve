# 12. Licence Billing (NX to Tenants) and Provider Memberships (Tenants to Providers)

Both levels use the **same billing engine** (`packages/domain/billing`) with the same metrics and
price models.

## 1. Price components

A plan version (or provider plan) price = sum of components.

| Metric | Meaning |
|---|---|
| flat | Fixed subscription |
| active_providers | Provider orgs with >= 1 completed order in the period |
| active_agents | Field workers active in the period (seats) |
| completed_orders | Captured orders in the period |
| gmv | Captured order value in the period |
| cities, service_modules, branded_app_pairs, api_calls, sms_messages | Self-explanatory |

| Model | Meaning |
|---|---|
| flat | Fixed amount |
| per_unit | quantity above included units x unit price |
| graduated | Each bracket at its own rate |
| volume | Whole quantity at the bracket reached |
| package | Price per block of N units |
| percent | % of GMV |

Controls: included units, min/max per component, minimum commitment per interval, hard limit
(block) vs soft (bill overage), yearly discount, billing interval, trial, per-tenant negotiated
overrides, add-ons.

## 2. Example licence plans (illustrative, not pricing advice)

- Subscription only: 3,000 SAR/month, everything within limits.
- Hybrid: 1,500 SAR/month incl. 10 active providers and 300 orders; then 50 SAR per provider and
  2 SAR per order.
- Usage only: 1% of GMV with 1,000 SAR monthly minimum.

## 3. Licence billing process

1. Usage aggregation jobs write `usage_records` per metric per period.
2. Invoice generation at period end (advance components at period start), with bracket breakdown
   in `calc_details`.
3. ZATCA e-invoice issuance via `EInvoicingProvider`.
4. Collection: card on file via NX's own Moyasar merchant account (not the platform agreement),
   dunning (retries, reminders, grace period), suspension per policy, reactivation.

## 4. Provider memberships

Tenant defines `provider_plans` (free, basic, gold...) with price components, benefits and
collection method.

Benefits (`provider_plan_benefits`): fee_schedule (lower commission), dispatch_boost,
max_categories, max_agents, featured_listing, badge, payout_schedule, analytics.

Collection methods:
- `offset_from_earnings` (default): part of the provider's split on next orders is redirected to
  the tenant until dues are settled (`provider_dues_offsets`), shown line by line in the provider
  statement. Requires provider consent in terms.
- `card_on_file`: charged via the tenant's merchant account.
- `invoice`: manual.

Rule of thumb for tenants: a membership must save or earn the provider more than it costs.
