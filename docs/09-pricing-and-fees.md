# 09. Pricing and Fees

## 1. Pricing strategies

Selected per scope (vertical, category, tier, city, zone), most specific wins:

| Strategy | Use |
|---|---|
| `fixed` | Flat price per service/unit (AC unit cleaning). |
| `formula` | Uber-style rate cards (towing, moving, delivery). |
| `quote` | Providers send quotes; customer picks (large moves). |
| `negotiation` | Counter-offers with floor and max rounds. |

Tier `pricing_mode`: `upfront` (default), `metered`, `fixed`, `quote`.

## 2. Rate card fields

base_fare, booking_fee, included_km, per_km, approach_per_km, approach_free_km, per_min,
free_wait_min, per_wait_min, flat_fare, minimum_fare, maximum_fare, class_multiplier,
auth_buffer_pct, reprice_threshold_pct, rounding, cancellation_fee, cancellation_free_min,
versioning (draft, pending_approval, active, archived), validity dates, maker-checker.

Scope: tier x city x optional zone x optional vehicle class. Modifiers (`rate_card_modifiers`)
add conditional charges from order attributes (accident vehicle, AWD, basement).

## 3. Calculation order (domain function `price()`)

1. Resolve rate card (most specific active).
2. Distance and duration from `MapsProvider` routing (pickup to drop-off), approach distance from
   nearest eligible agent (or zone average when unknown).
3. `base + max(0, km - included_km) * per_km + minutes * per_min + max(0, approach_km -
   approach_free_km) * approach_per_km`.
4. Modifiers, then `class_multiplier`.
5. Zone surcharges (pickup/drop-off) or zone-to-zone fixed fare (overrides 3 to 5).
6. Surge multiplier (schedule and dynamic combined per policy, capped).
7. Add-ons (provider add-ons, item-based charges).
8. Clamp to minimum/maximum, apply rounding.
9. Platform fees (fee engine) and VAT lines.
10. `auth_amount = total * (1 + auth_buffer_pct)`.

Worked example (towing, Riyadh, luxury class): base 80 incl. 5 km, per km 4, per min 0.5, approach
2/km after 5 free km, class 1.3, surge 1.2; trip 22 km / 30 min, approach 8 km:
80 + 68 + 15 + 6 = 169; x1.3 = 219.70; x1.2 = 263.64; rounded 264 SAR; authorize 304 SAR.

## 4. Estimates

`price_estimates` stores inputs and itemized breakdown with a short expiry (default 5 min). An order
must reference a valid estimate (upfront mode). Final price equals estimate unless actual route
deviates beyond `reprice_threshold_pct` or extra paid work is approved.

## 5. Surge

- Scheduled: days of week, time windows, date ranges, multiplier >= 1.
- Dynamic: ratio of open requests to available agents per zone over a window; step table; max cap;
  minimum hold; combined with schedule by `max` or `multiply`.
- Customer must explicitly acknowledge surge before confirming. Towing is an emergency service:
  launch with scheduled surge only and low caps.

## 6. Fee engine

`fee_schedules` (scope + `gateway_fee_bearer` platform|provider + versioning + maker-checker) with
`fee_components`:

| Field | Values |
|---|---|
| bearer | customer, provider, platform |
| calc | percent, fixed, percent_plus_fixed |
| rate_pct / fixed_amount | numbers |
| min_amount / max_amount | bounds |
| base | service_amount, addons, order_total |
| payment_method | NULL for all (mandatory NULL when bearer is customer) |
| vat_mode | exclusive, inclusive, exempt |
| refundable | maps to split `refundable` |
| show_to_customer | visibility |

Membership `fee_schedule` benefit overrides the provider's commission (e.g. gold 8% vs 15%).

## 7. Gateway fee mirror

`gateway_fee_rates` mirrors the Moyasar fee matrix per merchant to estimate margins before the
card type is known (mada cap 200 SAR). The real fee from the payment response is stored after
payment.

## 8. Admin tooling

- **Fee and price simulator**: amount, method, tier, distance, class; shows customer total,
  provider net, Moyasar fee + VAT, platform net, VAT payable.
- **Maker-checker** for rate cards and fee schedules (creator cannot approve); optional for small
  tenants via setting, mandatory above thresholds.
- **Effective dating** and archived versions; every order stores the exact versions used.
