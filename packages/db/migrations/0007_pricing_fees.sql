-- =====================================================================
-- 0007 Pricing and fee engines (reference schema sections 4, 4b, 10c to 10h).
-- Money columns are bigint minor units with a currency. Rates, multipliers,
-- distances and durations stay numeric. Amounts inside jsonb params are minor
-- units by convention and validated by Zod in packages/contracts.
-- =====================================================================

CREATE TYPE pricing_strategy AS ENUM ('fixed', 'formula', 'quote', 'negotiation');
CREATE TYPE fee_bearer AS ENUM ('customer', 'provider', 'platform');
CREATE TYPE fee_calc AS ENUM ('percent', 'fixed', 'percent_plus_fixed');

CREATE TABLE pricing_rules (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  vertical_id         uuid NOT NULL,
  category_id         uuid,
  city_id             uuid REFERENCES cities(id),
  zone_id             uuid,
  strategy            pricing_strategy NOT NULL,
  params              jsonb NOT NULL DEFAULT '{}',
  auth_buffer_pct     numeric(5,2) NOT NULL DEFAULT 0,
  cancellation_policy jsonb,
  priority            int NOT NULL DEFAULT 0,
  valid_from          timestamptz,
  valid_to            timestamptz,
  version             int NOT NULL DEFAULT 1,
  is_active           boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id)
);
CREATE INDEX pricing_rules_tenant_idx ON pricing_rules (tenant_id);

CREATE TABLE fee_schedules (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  name                jsonb NOT NULL,
  vertical_id         uuid,
  category_id         uuid,
  city_id             uuid REFERENCES cities(id),
  zone_id             uuid,
  provider_org_id     uuid,
  currency            char(3) NOT NULL DEFAULT 'SAR',
  gateway_fee_bearer  fee_bearer NOT NULL DEFAULT 'platform'
                      CHECK (gateway_fee_bearer <> 'customer'),
  priority            int NOT NULL DEFAULT 0,
  valid_from          timestamptz,
  valid_to            timestamptz,
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'pending_approval', 'active', 'archived')),
  version             int NOT NULL DEFAULT 1,
  created_by          uuid,
  approved_by         uuid,
  approved_at         timestamptz,
  CHECK (approved_by IS NULL OR approved_by <> created_by),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id),
  FOREIGN KEY (tenant_id, provider_org_id) REFERENCES provider_orgs (tenant_id, id)
);
CREATE INDEX fee_schedules_tenant_idx ON fee_schedules (tenant_id);

CREATE TABLE fee_components (
  id                uuid PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  schedule_id       uuid NOT NULL,
  code              text NOT NULL,
  label             jsonb NOT NULL,
  bearer            fee_bearer NOT NULL,
  calc              fee_calc NOT NULL,
  rate_pct          numeric(6,3),
  fixed_amount_minor bigint,
  min_amount_minor  bigint,
  max_amount_minor  bigint,
  base              text NOT NULL DEFAULT 'service_amount'
                    CHECK (base IN ('service_amount', 'addons', 'order_total')),
  payment_method    text,
  vat_mode          text NOT NULL DEFAULT 'exclusive'
                    CHECK (vat_mode IN ('exclusive', 'inclusive', 'exempt')),
  refundable        boolean NOT NULL DEFAULT true,
  show_to_customer  boolean NOT NULL DEFAULT true,
  sort_order        int NOT NULL DEFAULT 0,
  -- Customer-borne fees must be identical across payment methods (no surcharging).
  CHECK (bearer <> 'customer' OR payment_method IS NULL),
  CHECK (calc <> 'percent' OR rate_pct IS NOT NULL),
  CHECK (calc <> 'fixed' OR fixed_amount_minor IS NOT NULL),
  CHECK (calc <> 'percent_plus_fixed' OR (rate_pct IS NOT NULL AND fixed_amount_minor IS NOT NULL)),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, schedule_id) REFERENCES fee_schedules (tenant_id, id)
);
CREATE INDEX fee_components_tenant_idx ON fee_components (tenant_id);

CREATE TABLE gateway_fee_rates (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  provider_org_id    uuid,
  payment_method     text NOT NULL,
  rate_pct           numeric(6,3) NOT NULL,
  fixed_amount_minor bigint NOT NULL DEFAULT 0,
  cap_amount_minor   bigint,
  currency           char(3) NOT NULL DEFAULT 'SAR',
  vat_pct            numeric(5,2) NOT NULL DEFAULT 15,
  valid_from         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, provider_org_id) REFERENCES provider_orgs (tenant_id, id)
);
CREATE INDEX gateway_fee_rates_tenant_idx ON gateway_fee_rates (tenant_id);

CREATE TABLE service_tiers (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  vertical_id        uuid NOT NULL,
  category_id        uuid,
  code               text NOT NULL,
  name               jsonb NOT NULL,
  description        jsonb,
  icon_url           text,
  required_capabilities jsonb NOT NULL DEFAULT '{}',
  allowed_vehicle_classes uuid[],
  pricing_mode       text NOT NULL DEFAULT 'upfront'
                     CHECK (pricing_mode IN ('upfront', 'metered', 'fixed', 'quote')),
  payment_plan_id    uuid,                 -- FK added in 0010
  max_stops          int NOT NULL DEFAULT 2,
  sort_order         int NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, vertical_id, code),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id)
);
CREATE INDEX service_tiers_tenant_idx ON service_tiers (tenant_id);

CREATE TABLE service_availability (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  vertical_id      uuid NOT NULL,
  category_id      uuid,
  tier_id          uuid,
  city_id          uuid NOT NULL REFERENCES cities(id),
  zone_id          uuid,
  operating_hours  jsonb,
  allow_intercity  boolean NOT NULL DEFAULT false,
  launch_at        timestamptz,
  is_active        boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id),
  FOREIGN KEY (tenant_id, tier_id) REFERENCES service_tiers (tenant_id, id),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id)
);
CREATE INDEX service_availability_tenant_idx ON service_availability (tenant_id);

CREATE TABLE rate_cards (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  tier_id             uuid NOT NULL,
  city_id             uuid NOT NULL REFERENCES cities(id),
  zone_id             uuid,
  vehicle_class_id    uuid,
  currency            char(3) NOT NULL DEFAULT 'SAR',
  base_fare_minor     bigint NOT NULL DEFAULT 0,
  booking_fee_minor   bigint NOT NULL DEFAULT 0,
  included_km         numeric(8,2) NOT NULL DEFAULT 0,
  per_km              numeric(10,3) NOT NULL DEFAULT 0,
  approach_per_km     numeric(10,3) NOT NULL DEFAULT 0,
  approach_free_km    numeric(8,2) NOT NULL DEFAULT 0,
  per_min             numeric(10,3) NOT NULL DEFAULT 0,
  free_wait_min       int NOT NULL DEFAULT 0,
  per_wait_min        numeric(10,3) NOT NULL DEFAULT 0,
  flat_fare_minor     bigint,
  minimum_fare_minor  bigint NOT NULL DEFAULT 0,
  maximum_fare_minor  bigint,
  class_multiplier    numeric(6,3) NOT NULL DEFAULT 1,
  extra_stop_fee_minor bigint NOT NULL DEFAULT 0,
  auth_buffer_pct     numeric(5,2) NOT NULL DEFAULT 15,
  reprice_threshold_pct numeric(5,2) NOT NULL DEFAULT 20,
  rounding            text NOT NULL DEFAULT 'nearest_1'
                      CHECK (rounding IN ('none', 'nearest_0_5', 'nearest_1', 'up_5')),
  cancellation_fee_minor bigint NOT NULL DEFAULT 0,
  cancellation_free_min int NOT NULL DEFAULT 2,
  version             int NOT NULL DEFAULT 1,
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'pending_approval', 'active', 'archived')),
  valid_from          timestamptz,
  valid_to            timestamptz,
  created_by          uuid,
  approved_by         uuid,
  CHECK (approved_by IS NULL OR approved_by <> created_by),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, tier_id) REFERENCES service_tiers (tenant_id, id),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id),
  FOREIGN KEY (tenant_id, vehicle_class_id) REFERENCES vehicle_classes (tenant_id, id)
);
CREATE INDEX rate_cards_lookup ON rate_cards (tenant_id, tier_id, city_id, status);

CREATE TABLE rate_card_modifiers (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  rate_card_id  uuid NOT NULL,
  name          jsonb NOT NULL,
  condition     jsonb NOT NULL,
  calc          fee_calc NOT NULL,
  rate_pct      numeric(6,3),
  fixed_amount_minor bigint,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, rate_card_id) REFERENCES rate_cards (tenant_id, id)
);
CREATE INDEX rate_card_modifiers_tenant_idx ON rate_card_modifiers (tenant_id);

CREATE TABLE zone_surcharges (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  zone_id       uuid NOT NULL,
  tier_id       uuid,
  applies_on    text NOT NULL DEFAULT 'pickup' CHECK (applies_on IN ('pickup', 'dropoff', 'either')),
  calc          fee_calc NOT NULL,
  rate_pct      numeric(6,3),
  fixed_amount_minor bigint,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id),
  FOREIGN KEY (tenant_id, tier_id) REFERENCES service_tiers (tenant_id, id)
);
CREATE INDEX zone_surcharges_tenant_idx ON zone_surcharges (tenant_id);

CREATE TABLE zone_to_zone_fares (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  tier_id       uuid NOT NULL,
  from_zone_id  uuid NOT NULL,
  to_zone_id    uuid NOT NULL,
  vehicle_class_id uuid,
  fare_minor    bigint NOT NULL,
  currency      char(3) NOT NULL DEFAULT 'SAR',
  bidirectional boolean NOT NULL DEFAULT true,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, tier_id) REFERENCES service_tiers (tenant_id, id),
  FOREIGN KEY (tenant_id, from_zone_id) REFERENCES zones (tenant_id, id),
  FOREIGN KEY (tenant_id, to_zone_id) REFERENCES zones (tenant_id, id),
  FOREIGN KEY (tenant_id, vehicle_class_id) REFERENCES vehicle_classes (tenant_id, id)
);
CREATE INDEX zone_to_zone_fares_tenant_idx ON zone_to_zone_fares (tenant_id);

CREATE TABLE surge_schedules (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  name          jsonb NOT NULL,
  tier_id       uuid,
  city_id       uuid REFERENCES cities(id),
  zone_id       uuid,
  days_of_week  int[],
  time_from     time,
  time_to       time,
  date_from     date,
  date_to       date,
  multiplier    numeric(4,2) NOT NULL CHECK (multiplier >= 1),
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, tier_id) REFERENCES service_tiers (tenant_id, id),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id)
);
CREATE INDEX surge_schedules_tenant_idx ON surge_schedules (tenant_id);

CREATE TABLE surge_policies (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  tier_id            uuid,
  zone_id            uuid,
  steps              jsonb NOT NULL,
  window_minutes     int NOT NULL DEFAULT 10,
  max_multiplier     numeric(4,2) NOT NULL DEFAULT 2.0,
  min_hold_minutes   int NOT NULL DEFAULT 5,
  combine_with_schedule text NOT NULL DEFAULT 'max' CHECK (combine_with_schedule IN ('max', 'multiply')),
  requires_customer_ack boolean NOT NULL DEFAULT true,
  is_active          boolean NOT NULL DEFAULT false,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, tier_id) REFERENCES service_tiers (tenant_id, id),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id)
);
CREATE INDEX surge_policies_tenant_idx ON surge_policies (tenant_id);

CREATE TABLE surge_snapshots (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  zone_id       uuid NOT NULL,
  tier_id       uuid,
  demand        int NOT NULL,
  supply        int NOT NULL,
  multiplier    numeric(4,2) NOT NULL,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id),
  FOREIGN KEY (tenant_id, tier_id) REFERENCES service_tiers (tenant_id, id)
);
CREATE INDEX surge_snapshots_tenant_idx ON surge_snapshots (tenant_id, zone_id, computed_at);

SELECT nx_enable_tenant_rls('pricing_rules');
SELECT nx_enable_tenant_rls('fee_schedules');
SELECT nx_enable_tenant_rls('fee_components');
SELECT nx_enable_tenant_rls('gateway_fee_rates');
SELECT nx_enable_tenant_rls('service_tiers');
SELECT nx_enable_tenant_rls('service_availability');
SELECT nx_enable_tenant_rls('rate_cards');
SELECT nx_enable_tenant_rls('rate_card_modifiers');
SELECT nx_enable_tenant_rls('zone_surcharges');
SELECT nx_enable_tenant_rls('zone_to_zone_fares');
SELECT nx_enable_tenant_rls('surge_schedules');
SELECT nx_enable_tenant_rls('surge_policies');
SELECT nx_enable_tenant_rls('surge_snapshots');
