# 02. Domain Model and Glossary

## 1. Hierarchy

```
Platform (NX)
 └─ Tenant (white-label business, e.g. "Sathat Riyadh")        tenants
     ├─ Domains, branding, apps, payment gateway, API clients
     ├─ Vertical (service type: towing, moving, ...)            verticals
     │   ├─ Category tree (light vehicles, heavy vehicles ...)  categories
     │   ├─ Attribute definitions (dynamic fields)              attribute_definitions
     │   ├─ Item catalogs (furniture pieces ...)                item_catalogs, catalog_items
     │   ├─ Workflow + stages                                   workflow_definitions, workflow_stages
     │   ├─ Service tiers (cards the customer picks)            service_tiers
     │   ├─ Availability per city/zone                          service_availability
     │   ├─ Rate cards, zone fares, surge                       rate_cards, zone_*, surge_*
     │   ├─ Fee schedules                                       fee_schedules, fee_components
     │   └─ Dispatch policies                                   dispatch_policies
     ├─ Provider org (freelancer / establishment / company)     provider_orgs
     │   ├─ Agents (field workers)                              provider_agents
     │   ├─ Assets (trucks, vans, equipment)                    assets
     │   ├─ Offerings (approved per category + zone)            provider_offerings
     │   ├─ Documents, add-ons, membership                      provider_documents, provider_addons, provider_subscriptions
     ├─ Customers, vehicles                                     customers, customer_vehicles
     └─ Orders                                                  orders, order_items, order_addons, order_events,
                                                                dispatch_offers, tracking_points, payments, payment_splits
```

## 2. Glossary (English / Arabic)

| Term | Arabic | Meaning |
|---|---|---|
| Tenant | حساب الوايت ليبل / المستأجر | A licensed business running its own branded platform. |
| Platform owner | مالك المنصة | NX; also a tenant for its own brands. |
| Vertical | خدمة رئيسية | A service type (towing). Defines defaults for fulfillment, tracking, workflow. |
| Category | تصنيف | Sub-type inside a vertical; unlimited tree; can override fulfillment/tracking/workflow. |
| Tier | فئة الخدمة | What the customer picks (standard flatbed, hydraulic, enclosed). Has pricing mode and required capabilities. |
| Vehicle class | فئة السيارة | Tenant-defined class of the customer's vehicle (economy, luxury). |
| Fulfillment mode | طريقة التنفيذ | at_customer, point_to_point, at_provider, remote. |
| Tracking mode | نوع التتبع | none, en_route, full_trip; refined per stage by `tracking_active`. |
| Workflow stage | مرحلة الطلب | Visible step mapped to a core status; drives tracking, payment action, proof, notifications. |
| Core status | الحالة الأساسية | Engine-level order status the payment/dispatch engines understand. |
| Attribute definition | حقل ديناميكي | Field definition with scope (order, provider capability, asset), type, validation, pricing/matching flags. |
| Provider org | المزود | Business or freelancer, a Moyasar merchant (entity). |
| Agent | المنفذ / السائق / الفني | Person doing the job in the field. |
| Asset | المعدة / المركبة | Truck, van, equipment with dynamic attributes. |
| Offering | خدمة المزود | Approval of an org for a category in a zone with capabilities. |
| Rate card | بطاقة الأسعار | Numeric pricing fields per tier x city x zone x vehicle class. |
| Fee schedule | جدول الرسوم | Platform fees: who pays, how computed. |
| Split | تقسيم | Portion of a Moyasar payment for a recipient. |
| Fee source | مصدر الرسوم | The split from which Moyasar's fee is deducted. |
| Module | موديول | Sellable unit: service module or capability module. |
| Entitlement | الاستحقاق | What a tenant may use, from plan + add-ons + overrides. |
| Permission | الصلاحية | What a staff user may do. |
| Membership | عضوية المزود | Tenant's plan sold to its providers. |

## 3. Core order statuses (engine level)

`draft, quoting, awaiting_payment, dispatching, assigned, authorized, en_route, arrived,
in_progress, completed, captured, cancelled, failed, disputed`

Workflow stages map onto these. Engines react only to core statuses and stage flags.

## 4. Key invariants

1. Every row belongs to exactly one tenant (except global reference data: cities, vehicle makes,
   models, body types, permissions, setting definitions, NX templates, modules, plans).
2. An order freezes its pricing snapshot, fee snapshot and workflow version at creation.
3. Sum of splits = payment amount; at most one fee source; entity splits never negative.
4. Captured amount <= authorized amount.
5. A provider receives orders only for categories where its offering is `approved`, its Moyasar
   merchant is `active` (or `semi_active` per setting), and its documents are valid.
6. Provider-owned fields never influence pricing or matching.
7. Customer-borne fees never vary by payment method.
