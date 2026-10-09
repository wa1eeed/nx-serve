# 05. Services, Dynamic Fields and Fulfillment Modes

## 1. A service is a recipe of settings

| Setting | Towing | AC maintenance | Consultation |
|---|---|---|---|
| Fulfillment | point_to_point | at_customer | remote |
| Tracking | full_trip | en_route | none |
| Order fields | vehicle, condition, wheels locked, destination | unit type, unit count, service type | topic, attachment |
| Pricing | formula (base + km + min) per tier and vehicle class | fixed per unit | fixed per session |
| Dispatch | auto nearest eligible | broadcast to eligible | customer picks provider |
| Payment | authorize at assignment, capture at delivery | authorize, capture after repair | full payment at booking |
| Proof | photos before/after + OTP | photos + signature | none |
| Stages | see docs/07 | see docs/07 | see docs/07 |

Fulfillment and tracking are set on the vertical and can be overridden per category (e.g. a
"battery boost" category inside towing is `at_customer` with `en_route` tracking).

## 2. The four layers of the order form

**Layer 1. Core fields (every order, any service)**
service and category, timing (`now`, `scheduled`, `flexible_window`), customer notes,
attachments, on-site contact (masked), price shown, payment method, acceptance of terms and
cancellation policy. System fields: channel, pricing snapshot, status.

**Layer 2. Fulfillment fields (automatic per mode)**

| Mode | Fields |
|---|---|
| at_customer | one location + details (building, floor, landmark, access notes) |
| point_to_point | pickup + drop-off with details |
| at_provider | provider branch + appointment slot |
| remote | none |

DB checks enforce: point_to_point requires origin and destination; at_customer requires origin.

**Layer 3. Service core fields (tenant admin)**
Defined in `attribute_definitions` with scope `order`. These are the only fields allowed to
affect pricing (`used_in_pricing`) and matching (`used_in_matching` + `match_rule` against
provider capabilities). Examples:
- Towing: vehicle (reference to customer vehicle / model), condition (runs / does not run /
  accident), wheels locked, basement pickup.
- Moving: furniture items (item_list), floor, elevator, disassembly needed.
- AC: unit type, unit count, service type.

**Layer 4. Provider content**
- **Paid add-ons** (`provider_addons`): wrapping per item, crane, disassembly. Admin-reviewed.
  Included in the authorized amount and in the provider split.
- **Extra questions** (`attribute_definitions.owner_org_id`): shown only when the provider is known
  (customer-picked provider, or after acceptance). Never affect price or matching (DB check).
- **Field suggestions**: provider proposes a field; admin can promote it to a core field for the
  whole category.

## 3. Field types

`text, number, boolean, single_select, multi_select, date, location, media, item_list, reference`

- `options`: localized option list.
- `validation`: min/max/regex/required.
- `visibility_rule`: conditional display (`show_if`).
- `item_list`: rows of catalog items with quantity and details; stored relationally in
  `order_items` for pricing and analytics; `allow_custom` lets customers add "other".
- `reference`: points to a catalog (`vehicle_model`, `customer_vehicle`, `item_catalog:<code>`).

The same definition system serves three scopes: order fields, provider capabilities, asset
attributes. Matching compares order values with provider/asset capabilities via `match_rule`.

## 4. Rendering

Apps and web render forms from a **form schema endpoint** (`GET /v1/catalog/verticals/{id}/form`)
that merges layers, resolves locale, applies entitlements and returns a versioned JSON schema.
One renderer in `packages/ui-native` and one in `packages/ui-web`, sharing validation from
`packages/domain`. New fields appear without app releases.

## 5. Why core fields are not left to providers

1. Auto dispatch needs one form before the provider is known.
2. Pricing formulas need stable inputs.
3. Quotes are only comparable on identical information.
4. Free-form provider fields enable taking customers off-platform (phone numbers, links).
5. PDPL: the tenant is accountable for what is collected.
