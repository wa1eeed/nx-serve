-- =====================================================================
-- NX Field Services Platform: Core Schema (PostgreSQL 16 + PostGIS)
-- Principle: verticals, fields, pricing and dispatch are DATA, not code.
-- Launching a new service = inserting configuration rows, no migration.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- 1. GEOGRAPHY
-- =====================================================================
CREATE TABLE cities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  timezone    text NOT NULL DEFAULT 'Asia/Riyadh',
  is_active   boolean NOT NULL DEFAULT true
);

-- Zones are drawn polygons inside a city (more precise than city names).
CREATE TABLE zones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id     uuid NOT NULL REFERENCES cities(id),
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  boundary    geography(MultiPolygon, 4326) NOT NULL,
  is_active   boolean NOT NULL DEFAULT true
);
CREATE INDEX zones_boundary_gix ON zones USING gist (boundary);

-- =====================================================================
-- 2. SERVICE CATALOG (each vertical is configuration)
-- =====================================================================
-- How the service is delivered. Drives which location fields appear,
-- whether GPS tracking runs, and which pricing inputs exist.
CREATE TYPE fulfillment_mode AS ENUM (
  'at_customer',     -- provider goes to one customer location (AC repair, cleaning)
  'point_to_point',  -- pickup -> drop-off (towing, moving, delivery)
  'at_provider',     -- customer goes to provider (workshop, salon), appointment slot
  'remote'           -- no location (consultation, design, online service)
);
CREATE TYPE tracking_mode AS ENUM ('none', 'en_route', 'full_trip');

CREATE TABLE verticals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_fulfillment fulfillment_mode NOT NULL DEFAULT 'at_customer',
  default_tracking    tracking_mode    NOT NULL DEFAULT 'en_route',
  code        text UNIQUE NOT NULL,            -- 'towing', 'home_ac', 'mobile_wash'
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  config      jsonb NOT NULL DEFAULT '{}',     -- flow options: photos required,
                                               -- completion OTP, destination needed...
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Unlimited category tree per vertical.
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id uuid NOT NULL REFERENCES verticals(id),
  parent_id   uuid REFERENCES categories(id),
  fulfillment fulfillment_mode,   -- NULL = inherit from vertical
  tracking    tracking_mode,      -- NULL = inherit from vertical
  code        text NOT NULL,
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  UNIQUE (vertical_id, code)
);

-- Dynamic fields. One definition table drives:
--   order forms (scope = order), provider capabilities, and assets.
CREATE TYPE attr_scope AS ENUM ('order', 'provider_capability', 'asset');
CREATE TYPE attr_type  AS ENUM ('text', 'number', 'boolean', 'single_select',
                                'multi_select', 'date', 'location', 'media',
                                'item_list');  -- repeatable items with quantity
                                               -- (furniture pieces, AC units...)

-- Who owns a field definition and whether it is live.
CREATE TYPE field_owner_status AS ENUM ('draft', 'pending_review', 'approved', 'rejected');

CREATE TABLE attribute_definitions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id      uuid NOT NULL REFERENCES verticals(id),
  category_id      uuid REFERENCES categories(id),   -- NULL = whole vertical
  scope            attr_scope NOT NULL,
  key              text NOT NULL,                    -- 'vehicle_type'
  label_ar         text NOT NULL,
  label_en         text NOT NULL,
  data_type        attr_type NOT NULL,
  options          jsonb,      -- [{"value":"suv","label_ar":"جيب","label_en":"SUV"}]
  validation       jsonb,      -- {"min":0,"max":50,"regex":"..."}
  is_required      boolean NOT NULL DEFAULT false,
  used_in_pricing  boolean NOT NULL DEFAULT false,
  used_in_matching boolean NOT NULL DEFAULT false,
  match_rule       jsonb,      -- how an order value matches a provider capability:
                               -- {"capability_key":"supported_vehicle_types","op":"contains"}
  visibility_rule  jsonb,      -- conditional display:
                               -- {"show_if":{"key":"has_elevator","eq":false}}
  item_catalog_id  uuid,       -- for item_list fields (FK added below)
  owner_org_id     uuid,       -- NULL = platform core field (admin)
                               -- set   = provider extra question (FK added below)
  review_status    field_owner_status NOT NULL DEFAULT 'approved',
  sort_order       int NOT NULL DEFAULT 0,
  version          int NOT NULL DEFAULT 1,
  is_active        boolean NOT NULL DEFAULT true,
  -- Provider fields can never drive pricing or matching (platform-wide logic).
  CHECK (owner_org_id IS NULL OR (used_in_pricing = false AND used_in_matching = false))
);
CREATE UNIQUE INDEX attr_def_unique ON attribute_definitions
  (vertical_id,
   COALESCE(category_id,  '00000000-0000-0000-0000-000000000000'::uuid),
   COALESCE(owner_org_id, '00000000-0000-0000-0000-000000000000'::uuid),
   scope, key);

-- Item catalogs for item_list fields. Admin-managed, reusable.
-- Example: catalog "furniture" -> sofa_3_seat, bed_king, fridge, wardrobe...
CREATE TABLE item_catalogs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id uuid NOT NULL REFERENCES verticals(id),
  code        text NOT NULL,
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  UNIQUE (vertical_id, code)
);

CREATE TABLE catalog_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id    uuid NOT NULL REFERENCES item_catalogs(id),
  code          text NOT NULL,
  name_ar       text NOT NULL,
  name_en       text NOT NULL,
  size_class    text,                 -- small | medium | large | xl
  pricing_units numeric(8,2) NOT NULL DEFAULT 1, -- weight in price formula
  attributes    jsonb NOT NULL DEFAULT '{}',     -- {"needs_disassembly":true,"fragile":false}
  allow_custom  boolean NOT NULL DEFAULT false,  -- customer may type "other" item
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (catalog_id, code)
);

ALTER TABLE attribute_definitions ADD CONSTRAINT attr_def_catalog_fk
  FOREIGN KEY (item_catalog_id) REFERENCES item_catalogs(id);

-- Documents/licenses required to be approved in a category
-- (e.g. towing needs vehicle registration and operating permit).
CREATE TABLE category_requirements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   uuid NOT NULL REFERENCES categories(id),
  doc_type      text NOT NULL,       -- 'vehicle_registration', 'operating_permit'
  label_ar      text NOT NULL,
  label_en      text NOT NULL,
  applies_to    text NOT NULL DEFAULT 'org', -- org | agent | asset
  is_required   boolean NOT NULL DEFAULT true,
  expires       boolean NOT NULL DEFAULT false -- track expiry and re-verify
);

-- =====================================================================
-- 3. PROVIDERS (freelancers and companies with fleets)
-- =====================================================================
CREATE TYPE provider_entity AS ENUM ('freelancer', 'establishment', 'company');

-- Mirrors Moyasar merchant statuses so the provider app can show them.
CREATE TYPE merchant_status AS ENUM ('draft', 'submitted', 'pending', 'missing_docs',
                                     'semi_active', 'active', 'hold', 'rejected', 'disabled');

CREATE TABLE provider_orgs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type         provider_entity NOT NULL,
  legal_name          text NOT NULL,
  display_name        text NOT NULL,
  registration_no     text,                    -- CR or freelance certificate
  city_id             uuid REFERENCES cities(id),
  moyasar_merchant_id text UNIQUE,             -- split recipient
  moyasar_status      merchant_status NOT NULL DEFAULT 'draft',
  nx_verify_ref       text,                    -- KYB/identity check reference
  rating              numeric(3,2),
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Field workers. A freelancer = one org + one agent with role 'owner'.
CREATE TABLE provider_agents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES provider_orgs(id),
  full_name   text NOT NULL,
  mobile      text NOT NULL UNIQUE,
  role        text NOT NULL DEFAULT 'technician', -- owner | driver | technician | dispatcher
  rating      numeric(3,2),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Vehicles / equipment (tow trucks, vans, tools) with dynamic attributes.
CREATE TABLE assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES provider_orgs(id),
  vertical_id   uuid NOT NULL REFERENCES verticals(id),
  asset_type    text NOT NULL,                 -- 'flatbed', 'wheel_lift'
  identifier    text,                          -- plate or serial
  attributes    jsonb NOT NULL DEFAULT '{}',   -- {"max_weight_kg":3500,"hydraulic":true}
  is_active     boolean NOT NULL DEFAULT true
);

CREATE TABLE agent_assets (
  agent_id      uuid NOT NULL REFERENCES provider_agents(id),
  asset_id      uuid NOT NULL REFERENCES assets(id),
  assigned_from timestamptz NOT NULL DEFAULT now(),
  assigned_to   timestamptz,
  PRIMARY KEY (agent_id, asset_id, assigned_from)
);

-- Groups: VIP fleet, insurance-approved partners, night shift...
CREATE TABLE provider_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id uuid REFERENCES verticals(id),
  name        text NOT NULL,
  description text
);

CREATE TABLE provider_group_members (
  group_id    uuid NOT NULL REFERENCES provider_groups(id),
  org_id      uuid REFERENCES provider_orgs(id),
  agent_id    uuid REFERENCES provider_agents(id),
  CHECK (org_id IS NOT NULL OR agent_id IS NOT NULL)
);

-- What each provider offers, where, and with which capabilities.
CREATE TABLE provider_offerings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES provider_orgs(id),
  vertical_id   uuid NOT NULL REFERENCES verticals(id),
  category_id   uuid REFERENCES categories(id),
  zone_id       uuid REFERENCES zones(id),     -- NULL = whole city of the org
  capabilities  jsonb NOT NULL DEFAULT '{}',   -- {"supported_vehicle_types":["sedan","suv"]}
  -- Per-category approval by platform admin (separate from Moyasar status).
  status        text NOT NULL DEFAULT 'applied',
                -- applied | under_review | needs_info | approved | suspended | rejected
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  review_notes  text,
  is_active     boolean NOT NULL DEFAULT true
);
CREATE INDEX offerings_caps_gin ON provider_offerings USING gin (capabilities);

-- Uploaded documents matched against category_requirements.
CREATE TABLE provider_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES provider_orgs(id),
  agent_id        uuid REFERENCES provider_agents(id),
  asset_id        uuid REFERENCES assets(id),
  doc_type        text NOT NULL,
  file_url        text NOT NULL,
  expires_on      date,
  verify_status   text NOT NULL DEFAULT 'pending', -- pending | verified | rejected | expired
  nx_verify_ref   text,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

-- Provider-defined paid extras (admin-approved).
-- Example (movers): wrapping 50 SAR/item, disassembly 80 SAR, crane 400 SAR.
CREATE TABLE provider_addons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id   uuid NOT NULL REFERENCES provider_offerings(id),
  name_ar       text NOT NULL,
  name_en       text NOT NULL,
  price_type    text NOT NULL DEFAULT 'flat',  -- flat | per_item | per_unit
  price         numeric(12,2) NOT NULL,
  review_status field_owner_status NOT NULL DEFAULT 'pending_review',
  is_active     boolean NOT NULL DEFAULT true
);

ALTER TABLE attribute_definitions ADD CONSTRAINT attr_def_owner_fk
  FOREIGN KEY (owner_org_id) REFERENCES provider_orgs(id);

-- Durable mirror of live location (hot path lives in Redis GEO).
CREATE TABLE agent_presence (
  agent_id    uuid PRIMARY KEY REFERENCES provider_agents(id),
  status      text NOT NULL DEFAULT 'offline', -- offline | online | busy
  location    geography(Point, 4326),
  heading     numeric,
  speed_kmh   numeric,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX presence_loc_gix ON agent_presence USING gist (location);

-- =====================================================================
-- 4. PRICING ENGINE (strategy chosen per vertical/category/zone)
-- =====================================================================
CREATE TYPE pricing_strategy AS ENUM ('fixed', 'formula', 'quote', 'negotiation');

CREATE TABLE pricing_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id         uuid NOT NULL REFERENCES verticals(id),
  category_id         uuid REFERENCES categories(id),
  city_id             uuid REFERENCES cities(id),
  zone_id             uuid REFERENCES zones(id),
  strategy            pricing_strategy NOT NULL,
  params              jsonb NOT NULL DEFAULT '{}',
  -- fixed:   {"amount":150}
  -- formula: {"base":80,"per_km":4,"per_min":0.5,"min_total":120,
  --           "modifiers":[{"attr":"vehicle_type","multipliers":{"suv":1.2,"truck":1.6}}],
  --           "surcharges":[{"name":"night","from":"22:00","to":"05:00","multiplier":1.25}]}
  -- quote:   {"max_quotes":5,"quote_ttl_sec":300}
  -- negotiation: {"floor":100,"max_rounds":3}
  auth_buffer_pct     numeric(5,2) NOT NULL DEFAULT 0,  -- extra % held at authorization
  -- Platform fees live in fee_schedules / fee_components (section 4b).
  cancellation_policy jsonb,                            -- fee by order stage
  priority            int NOT NULL DEFAULT 0,           -- most specific + highest wins
  valid_from          timestamptz,
  valid_to            timestamptz,
  version             int NOT NULL DEFAULT 1,
  is_active           boolean NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------
-- 4b. FEE ENGINE (who pays what, configurable without code)
-- ---------------------------------------------------------------------
CREATE TYPE fee_bearer AS ENUM ('customer', 'provider', 'platform');
CREATE TYPE fee_calc   AS ENUM ('percent', 'fixed', 'percent_plus_fixed');

-- A schedule = a versioned set of fee components for a scope.
-- Most specific active scope with highest priority wins.
CREATE TABLE fee_schedules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  vertical_id         uuid REFERENCES verticals(id),
  category_id         uuid REFERENCES categories(id),
  city_id             uuid REFERENCES cities(id),
  zone_id             uuid REFERENCES zones(id),
  provider_org_id     uuid REFERENCES provider_orgs(id),  -- negotiated provider deal
  -- Moyasar fee is deducted from ONE split (fee_source): provider or platform.
  -- A customer can only cover it indirectly through a flat service fee.
  gateway_fee_bearer  fee_bearer NOT NULL DEFAULT 'platform'
                      CHECK (gateway_fee_bearer <> 'customer'),
  priority            int NOT NULL DEFAULT 0,
  valid_from          timestamptz,
  valid_to            timestamptz,
  status              text NOT NULL DEFAULT 'draft',  -- draft | pending_approval | active | archived
  version             int NOT NULL DEFAULT 1,
  created_by          uuid,
  approved_by         uuid,                            -- maker-checker: creator cannot approve
  approved_at         timestamptz,
  CHECK (approved_by IS NULL OR approved_by <> created_by)
);

CREATE TABLE fee_components (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       uuid NOT NULL REFERENCES fee_schedules(id),
  code              text NOT NULL,      -- platform_commission | service_fee | booking_fee
  label_ar          text NOT NULL,
  label_en          text NOT NULL,
  bearer            fee_bearer NOT NULL,
  calc              fee_calc NOT NULL,
  rate_pct          numeric(6,3),       -- used by percent / percent_plus_fixed
  fixed_amount      numeric(12,2),      -- SAR, used by fixed / percent_plus_fixed
  min_amount        numeric(12,2),
  max_amount        numeric(12,2),
  base              text NOT NULL DEFAULT 'service_amount', -- service_amount | addons | order_total
  payment_method    text,               -- NULL = all methods
  vat_mode          text NOT NULL DEFAULT 'exclusive',      -- exclusive | inclusive | exempt
  refundable        boolean NOT NULL DEFAULT true,          -- maps to split "refundable"
  show_to_customer  boolean NOT NULL DEFAULT true,
  sort_order        int NOT NULL DEFAULT 0,
  -- Customer-borne fees must be identical across payment methods
  -- (no card surcharging).
  CHECK (bearer <> 'customer' OR payment_method IS NULL),
  CHECK (calc <> 'percent'            OR rate_pct IS NOT NULL),
  CHECK (calc <> 'fixed'              OR fixed_amount IS NOT NULL),
  CHECK (calc <> 'percent_plus_fixed' OR (rate_pct IS NOT NULL AND fixed_amount IS NOT NULL))
);

-- Mirror of the Moyasar fee matrix, used to estimate margins before
-- the real fee is known (card type is only known after payment).
CREATE TABLE gateway_fee_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_org_id uuid REFERENCES provider_orgs(id),  -- NULL = platform default
  payment_method  text NOT NULL,     -- mada | cc_local | cc_int | stcpay | amex
  rate_pct        numeric(6,3) NOT NULL,
  fixed_amount    numeric(12,2) NOT NULL DEFAULT 0,
  cap_amount      numeric(12,2),     -- mada: 200.00
  vat_pct         numeric(5,2) NOT NULL DEFAULT 15,
  valid_from      timestamptz NOT NULL DEFAULT now()
);

-- Quotes and counter-offers (quote / negotiation strategies).
CREATE TABLE quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL,                -- FK added after orders table
  org_id          uuid NOT NULL REFERENCES provider_orgs(id),
  agent_id        uuid REFERENCES provider_agents(id),
  parent_quote_id uuid REFERENCES quotes(id),   -- counter-offer chain
  offered_by      text NOT NULL,                -- provider | customer
  amount          numeric(12,2) NOT NULL,
  eta_minutes     int,
  note            text,
  status          text NOT NULL DEFAULT 'offered', -- offered | accepted | rejected | expired
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 5. DISPATCH ENGINE (mode chosen per vertical/category/zone/group)
-- =====================================================================
CREATE TYPE dispatch_mode AS ENUM ('auto_nearest', 'broadcast', 'manual', 'customer_choice');

CREATE TABLE dispatch_policies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id         uuid NOT NULL REFERENCES verticals(id),
  category_id         uuid REFERENCES categories(id),
  zone_id             uuid REFERENCES zones(id),
  group_id            uuid REFERENCES provider_groups(id), -- restrict to a group
  mode                dispatch_mode NOT NULL,
  params              jsonb NOT NULL DEFAULT '{}',
  -- {"radius_km":10,"max_candidates":5,"offer_timeout_sec":30,
  --  "rounds":3,"expand_radius_km":5,"rank_by":["distance","rating"]}
  fallback_policy_id  uuid REFERENCES dispatch_policies(id),  -- e.g. auto -> manual
  priority            int NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true
);

-- =====================================================================
-- 6. ORDERS
-- =====================================================================
CREATE TYPE order_status AS ENUM (
  'draft', 'quoting', 'awaiting_payment', 'dispatching', 'assigned', 'authorized',
  'en_route', 'arrived', 'in_progress', 'completed', 'captured',
  'cancelled', 'failed', 'disputed');

CREATE TABLE customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   text,
  mobile      text NOT NULL UNIQUE,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid NOT NULL REFERENCES customers(id),
  vertical_id         uuid NOT NULL REFERENCES verticals(id),
  category_id         uuid REFERENCES categories(id),
  city_id             uuid REFERENCES cities(id),
  zone_id             uuid REFERENCES zones(id),
  fulfillment         fulfillment_mode NOT NULL,     -- resolved from category/vertical
  tracking            tracking_mode NOT NULL,
  origin              geography(Point, 4326),        -- service or pickup point
                                                     -- (NULL for remote / at_provider)
  origin_details      jsonb,   -- {"building":"","floor":3,"landmark":"","access_notes":""}
  destination         geography(Point, 4326),        -- point_to_point only
  destination_details jsonb,
  timing_type         text NOT NULL DEFAULT 'now',   -- now | scheduled | flexible_window
  window_start        timestamptz,
  window_end          timestamptz,
  onsite_contact      jsonb,   -- {"name":"","phone_masked_ref":""} if not the customer
  customer_notes      text,
  source_channel      text,    -- ios | android | web | ops | api
  terms_accepted_at   timestamptz,                   -- incl. cancellation policy
  attributes          jsonb NOT NULL DEFAULT '{}',   -- validated vs attribute_definitions
  CHECK (fulfillment <> 'point_to_point' OR (origin IS NOT NULL AND destination IS NOT NULL)),
  CHECK (fulfillment <> 'at_customer'    OR origin IS NOT NULL),
  pricing_rule_id     uuid REFERENCES pricing_rules(id),
  pricing_snapshot    jsonb,   -- frozen rule version + inputs + price breakdown
  dispatch_policy_id  uuid REFERENCES dispatch_policies(id),
  estimated_amount    numeric(12,2),
  final_amount        numeric(12,2),
  currency            char(3) NOT NULL DEFAULT 'SAR',
  status              order_status NOT NULL DEFAULT 'draft',
  assigned_org_id     uuid REFERENCES provider_orgs(id),
  assigned_agent_id   uuid REFERENCES provider_agents(id),
  asset_id            uuid REFERENCES assets(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_attrs_gin   ON orders USING gin (attributes);
CREATE INDEX orders_origin_gix  ON orders USING gist (origin);
CREATE INDEX orders_status_zone ON orders (status, zone_id);

ALTER TABLE quotes ADD CONSTRAINT quotes_order_fk
  FOREIGN KEY (order_id) REFERENCES orders(id);

-- Rows of item_list fields (kept relational for pricing and reporting).
CREATE TABLE order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id),
  attribute_key   text NOT NULL,                  -- which item_list field
  catalog_item_id uuid REFERENCES catalog_items(id),
  custom_name     text,                           -- when allow_custom = true
  quantity        int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  details         jsonb NOT NULL DEFAULT '{}',    -- {"needs_disassembly":true}
  CHECK (catalog_item_id IS NOT NULL OR custom_name IS NOT NULL)
);

-- Extras chosen by the customer, with price frozen at order time.
CREATE TABLE order_addons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id),
  addon_id      uuid NOT NULL REFERENCES provider_addons(id),
  quantity      int NOT NULL DEFAULT 1,
  unit_price    numeric(12,2) NOT NULL,
  total_price   numeric(12,2) NOT NULL
);

CREATE TABLE dispatch_offers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id),
  agent_id      uuid NOT NULL REFERENCES provider_agents(id),
  round         int NOT NULL DEFAULT 1,
  distance_m    int,
  status        text NOT NULL DEFAULT 'sent', -- sent | accepted | declined | expired | cancelled
  sent_at       timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz
);

-- Full audit trail of the state machine.
CREATE TABLE order_events (
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id),
  from_status order_status,
  to_status   order_status NOT NULL,
  actor_type  text NOT NULL,    -- customer | agent | ops | system
  actor_id    uuid,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id),
  kind        text NOT NULL,    -- before | after | signature | damage
  url         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- GPS trail per order, partitioned by month for volume.
CREATE TABLE tracking_points (
  order_id    uuid NOT NULL,
  agent_id    uuid NOT NULL,
  location    geography(Point, 4326) NOT NULL,
  recorded_at timestamptz NOT NULL
) PARTITION BY RANGE (recorded_at);

-- =====================================================================
-- 7. PAYMENTS (Moyasar: authorize -> capture/void, with split)
-- =====================================================================
CREATE TYPE payment_status AS ENUM (
  'initiated', 'authorized', 'captured', 'partially_captured', 'voided',
  'refunded', 'partially_refunded', 'failed', 'expired');

CREATE TABLE payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id),
  purpose             text NOT NULL DEFAULT 'main', -- main | supplement | cancellation_fee
  moyasar_payment_id  text UNIQUE,
  moyasar_merchant_id text,
  method              text,                         -- mada | visa | mastercard | applepay...
  card_token_ref      text,                         -- tokenized card, never raw data
  authorized_amount   numeric(12,2),
  captured_amount     numeric(12,2) NOT NULL DEFAULT 0,
  refunded_amount     numeric(12,2) NOT NULL DEFAULT 0,
  status              payment_status NOT NULL DEFAULT 'initiated',
  auth_expires_at     timestamptz,                  -- capture or void before this
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment_splits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      uuid NOT NULL REFERENCES payments(id),
  recipient_type  text NOT NULL,     -- provider | platform | beneficiary
  recipient_ref   text NOT NULL,     -- Moyasar merchant / recipient id
  amount          numeric(12,2) NOT NULL,
  is_fee_source   boolean NOT NULL DEFAULT false, -- who absorbs Moyasar fees
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Idempotent webhook processing.
CREATE TABLE webhook_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL DEFAULT 'moyasar',
  event_id      text NOT NULL UNIQUE,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

-- =====================================================================
-- 8. MULTI-TENANCY (white-label)
-- Hierarchy: NX Super Admin -> Tenant (white-label admin) -> providers + customers.
-- NX's own brand is just another tenant with is_platform_owner = true.
-- =====================================================================
CREATE TABLE tenants (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text NOT NULL UNIQUE
                     CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'), -- default subdomain: slug.nx-domain
  legal_name         text NOT NULL,
  display_name       text NOT NULL,
  plan               text NOT NULL DEFAULT 'starter',  -- starter | pro | enterprise
  status             text NOT NULL DEFAULT 'trial',    -- trial | active | suspended | cancelled
  is_platform_owner  boolean NOT NULL DEFAULT false,
  default_locale     text NOT NULL DEFAULT 'ar',
  supported_locales  text[] NOT NULL DEFAULT '{ar,en}',
  branding           jsonb NOT NULL DEFAULT '{}',      -- logo, colors, fonts, favicon
  settings           jsonb NOT NULL DEFAULT '{}',
  nx_verify_ref      text,                             -- KYB of the tenant itself
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Subdomains and custom domains, each with its purpose.
CREATE TABLE tenant_domains (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  hostname            text NOT NULL UNIQUE,     -- acme.nx-domain.com | www.acme.sa
  kind                text NOT NULL,            -- subdomain | custom
  purpose             text NOT NULL DEFAULT 'website', -- website | admin | provider_portal | api
  verification_token  text,                     -- DNS TXT check for custom domains
  verified_at         timestamptz,
  ssl_status          text NOT NULL DEFAULT 'pending', -- pending | active | failed
  is_primary          boolean NOT NULL DEFAULT false
);

-- Payment gateway per tenant. Two models:
--   own_platform: tenant has its own Moyasar platform agreement (keys in a secret manager)
--   nx_master:    tenant runs under NX's Moyasar platform (requires Moyasar approval)
CREATE TABLE tenant_payment_gateways (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenants(id),
  gateway                text NOT NULL DEFAULT 'moyasar',
  mode                   text NOT NULL,          -- own_platform | nx_master
  credentials_ref        text,                   -- secret manager reference, never raw keys
  platform_recipient_id  text,                   -- split recipient for the tenant's fee
  environment            text NOT NULL DEFAULT 'sandbox', -- sandbox | live
  status                 text NOT NULL DEFAULT 'pending',
  UNIQUE (tenant_id, gateway, environment)
);

-- Branded mobile apps per tenant (customer + provider).
CREATE TABLE tenant_apps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  app_kind         text NOT NULL,                  -- customer | provider
  distribution     text NOT NULL DEFAULT 'web',    -- web (storefront + PWA, all plans) | branded (Advanced plan)
  app_name         text,
  ios_bundle_id    text UNIQUE,
  android_package  text UNIQUE,
  icon_url         text,
  splash           jsonb,
  theme            jsonb,
  store_accounts   jsonb,     -- references to the tenant's Apple / Google credentials
  build_status     text NOT NULL DEFAULT 'not_configured',
                   -- not_configured | configured | building | in_review | live | failed
  current_version  text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, app_kind)
);

CREATE TABLE app_builds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_app_id  uuid NOT NULL REFERENCES tenant_apps(id),
  platform       text NOT NULL,     -- ios | android
  version        text NOT NULL,
  build_number   int NOT NULL,
  ci_build_id    text,              -- e.g. EAS build id
  status         text NOT NULL DEFAULT 'queued', -- queued | building | submitted | failed
  log_url        text,
  started_at     timestamptz,
  finished_at    timestamptz
);

-- Public API access per tenant.
CREATE TABLE api_clients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  name               text NOT NULL,
  client_id          text NOT NULL UNIQUE,
  secret_hash        text NOT NULL,
  scopes             text[] NOT NULL DEFAULT '{}', -- orders:write, providers:read ...
  environment        text NOT NULL DEFAULT 'sandbox',
  rate_limit_per_min int NOT NULL DEFAULT 120,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_used_at       timestamptz
);

CREATE TABLE webhook_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  url         text NOT NULL,
  events      text[] NOT NULL,      -- order.created, order.completed, payment.captured ...
  secret_hash text NOT NULL,        -- HMAC signing
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE tenant_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  plan          text NOT NULL,
  price         numeric(12,2) NOT NULL,
  billing_cycle text NOT NULL,       -- monthly | yearly
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  status        text NOT NULL DEFAULT 'active'
);

-- Add tenant_id + Row Level Security to every business table.
-- cities stays global (shared reference data).
-- NOTE: review global UNIQUE constraints (verticals.code, customers.mobile,
-- provider_agents.mobile, moyasar_merchant_id, webhook_events.event_id...)
-- and scope them by tenant_id before production.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'zones','verticals','categories','attribute_definitions','item_catalogs',
    'catalog_items','category_requirements','provider_orgs','provider_agents',
    'assets','agent_assets','provider_groups','provider_group_members',
    'provider_offerings','provider_documents','provider_addons','agent_presence',
    'pricing_rules','fee_schedules','fee_components','gateway_fee_rates','quotes',
    'dispatch_policies','customers','orders','order_items','order_addons',
    'dispatch_offers','order_events','order_media','tracking_points',
    'payments','payment_splits','webhook_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id uuid NOT NULL REFERENCES tenants(id)', t);
    EXECUTE format('CREATE INDEX %I ON %I (tenant_id)', t || '_tenant_idx', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'')::uuid)', t);
  END LOOP;
END $$;
-- The API sets app.tenant_id per request from the resolved domain / token.
-- The NX super admin service role uses BYPASSRLS for cross-tenant views.

-- =====================================================================
-- 9. CONFIGURABLE WORKFLOWS, SERVICE TEMPLATES, MODULES & PLANS
-- Every service gets its own visible stages, mapped onto a small set of
-- core statuses that the payment, dispatch and tracking engines understand.
-- =====================================================================
CREATE TABLE workflow_definitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id),   -- NULL = NX global template
  name         text NOT NULL,
  version      int NOT NULL DEFAULT 1,
  is_active    boolean NOT NULL DEFAULT true
);

CREATE TABLE workflow_stages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid REFERENCES tenants(id),
  workflow_id        uuid NOT NULL REFERENCES workflow_definitions(id),
  code               text NOT NULL,            -- 'loading', 'in_transit', 'session_started'
  label_ar           text NOT NULL,            -- what the customer sees
  label_en           text NOT NULL,
  maps_to            order_status NOT NULL,    -- core status the engines act on
  sort_order         int NOT NULL,
  actor              text NOT NULL DEFAULT 'agent', -- agent | customer | system | ops
  tracking_active    boolean NOT NULL DEFAULT false, -- live GPS shown during this stage
  requires           jsonb NOT NULL DEFAULT '{}',
                     -- {"photos_min":2,"otp":true,"signature":false,"checklist":["..."]}
  payment_action     text NOT NULL DEFAULT 'none', -- none | authorize | capture | capture_partial
  notify             jsonb NOT NULL DEFAULT '{}',  -- {"customer":"push+sms","provider":"push"}
  sla_minutes        int,                      -- alert ops if stage exceeds this
  UNIQUE (workflow_id, code)
);

ALTER TABLE categories ADD COLUMN workflow_id uuid REFERENCES workflow_definitions(id);
ALTER TABLE verticals  ADD COLUMN workflow_id uuid REFERENCES workflow_definitions(id);

-- Ready-made service blueprints a tenant installs in one click, then edits.
-- payload bundles: vertical, categories, fields, item catalogs, workflow,
-- pricing rules, fee schedule, dispatch policy, requirements, notification texts.
CREATE TABLE service_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,     -- towing, moving, ac_service, home_cleaning, consultation
  name_ar       text NOT NULL,
  name_en       text NOT NULL,
  description   text,
  payload       jsonb NOT NULL,
  version       int NOT NULL DEFAULT 1,
  is_published  boolean NOT NULL DEFAULT false
);

CREATE TABLE tenant_template_installs (
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  template_id   uuid NOT NULL REFERENCES service_templates(id),
  version       int NOT NULL,
  vertical_id   uuid REFERENCES verticals(id),  -- the tenant's editable copy
  installed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, template_id)
);

-- ---------------------------------------------------------------------
-- 9b. MODULES, PLANS, MEMBERSHIPS (entitlements = what a tenant BOUGHT)
-- Two module kinds:
--   service    : towing, moving, ac_service ... (the WHAT, linked to a template)
--   capability : live_tracking, quotes, negotiation, scheduling, b2b_billing,
--                branded_apps, custom_domain, public_api, fleet_portal (the HOW)
-- A service module declares the capabilities it needs (towing -> live_tracking).
-- ---------------------------------------------------------------------
CREATE TABLE modules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  kind          text NOT NULL CHECK (kind IN ('service', 'capability')),
  name_ar       text NOT NULL,
  name_en       text NOT NULL,
  description   text,
  template_id   uuid REFERENCES service_templates(id),  -- service modules only
  is_published  boolean NOT NULL DEFAULT false,
  CHECK (kind = 'capability' OR template_id IS NOT NULL)
);

CREATE TABLE module_dependencies (
  module_id      uuid NOT NULL REFERENCES modules(id),
  requires_id    uuid NOT NULL REFERENCES modules(id),
  is_hard        boolean NOT NULL DEFAULT true,  -- false = works degraded without it
  PRIMARY KEY (module_id, requires_id),
  CHECK (module_id <> requires_id)
);

-- Quotas a plan can cap.
CREATE TABLE limit_definitions (
  code          text PRIMARY KEY,   -- max_service_modules, max_providers, max_agents,
                                    -- max_cities, max_admin_users, orders_per_month,
                                    -- api_calls_per_day, branded_app_pairs
  name_ar       text NOT NULL,
  name_en       text NOT NULL,
  unit          text NOT NULL DEFAULT 'count'
);

-- Tenant groups ("Resellers", "Enterprise", "Beta", "Government") for
-- bulk settings, targeted announcements and partner pricing.
CREATE TABLE tenant_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  settings      jsonb NOT NULL DEFAULT '{}'   -- defaults applied to members
);

CREATE TABLE tenant_group_members (
  group_id      uuid NOT NULL REFERENCES tenant_groups(id),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  PRIMARY KEY (group_id, tenant_id)
);

CREATE TABLE plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,   -- starter | growth | all_inclusive | enterprise
  name_ar       text NOT NULL,
  name_en       text NOT NULL,
  is_public     boolean NOT NULL DEFAULT true,   -- false = private/custom deal plan
  group_id      uuid REFERENCES tenant_groups(id), -- visible only to this group if set
  sort_order    int NOT NULL DEFAULT 0
);

-- Versioned so existing subscribers keep their terms when a plan changes.
CREATE TABLE plan_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          uuid NOT NULL REFERENCES plans(id),
  version          int NOT NULL,
  monthly_price    numeric(12,2),
  yearly_price     numeric(12,2),
  setup_fee        numeric(12,2) NOT NULL DEFAULT 0,
  txn_fee_pct      numeric(6,3) NOT NULL DEFAULT 0,  -- NX share of tenant GMV, if any
  trial_days       int NOT NULL DEFAULT 0,
  all_service_modules boolean NOT NULL DEFAULT false, -- "all-inclusive": every service module
  status           text NOT NULL DEFAULT 'draft',     -- draft | active | retired
  published_at     timestamptz,
  UNIQUE (plan_id, version)
);

CREATE TABLE plan_modules (
  plan_version_id  uuid NOT NULL REFERENCES plan_versions(id),
  module_id        uuid NOT NULL REFERENCES modules(id),
  PRIMARY KEY (plan_version_id, module_id)
);

CREATE TABLE plan_limits (
  plan_version_id  uuid NOT NULL REFERENCES plan_versions(id),
  limit_code       text NOT NULL REFERENCES limit_definitions(code),
  value            int,                -- NULL = unlimited
  PRIMARY KEY (plan_version_id, limit_code)
);

-- Add-ons a tenant can buy on top of any plan (one extra module, more providers...).
CREATE TABLE addon_products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  module_id     uuid REFERENCES modules(id),
  limit_code    text REFERENCES limit_definitions(code),
  limit_delta   int,
  monthly_price numeric(12,2) NOT NULL,
  CHECK (module_id IS NOT NULL OR limit_code IS NOT NULL)
);

CREATE TABLE tenant_addons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  addon_id      uuid NOT NULL REFERENCES addon_products(id),
  quantity      int NOT NULL DEFAULT 1,
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz
);

-- Super-admin overrides for a specific tenant (special deal, pilot, block).
CREATE TABLE tenant_entitlement_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  module_id     uuid REFERENCES modules(id),
  limit_code    text REFERENCES limit_definitions(code),
  enabled       boolean,        -- for modules
  value         int,            -- for limits
  reason        text NOT NULL,
  expires_at    timestamptz,
  created_by    uuid,
  CHECK (module_id IS NOT NULL OR limit_code IS NOT NULL)
);

-- Effective entitlements = plan_version + addons + overrides (+ dependency check),
-- computed by the API and cached; every module/limit check reads this.

ALTER TABLE tenants DROP COLUMN plan;
ALTER TABLE tenant_subscriptions DROP COLUMN plan;
ALTER TABLE tenant_subscriptions
  ADD COLUMN plan_version_id uuid NOT NULL REFERENCES plan_versions(id);

-- ---------------------------------------------------------------------
-- 9c. ROLES & PERMISSIONS (what each USER inside a tenant may do)
-- Effective access = tenant entitlement AND user permission.
-- ---------------------------------------------------------------------
CREATE TABLE permissions (
  code          text PRIMARY KEY,   -- orders.view, orders.dispatch, pricing.edit,
                                    -- pricing.approve, providers.approve, finance.view,
                                    -- apps.build, api_keys.manage, users.manage
  module_code   text,               -- permission only shown if this module is entitled
  description   text
);

CREATE TABLE roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id),  -- NULL = NX system role template
  scope         text NOT NULL,                -- platform | tenant | provider_org
  code          text NOT NULL,                -- owner, ops_manager, dispatcher, finance, support
  name_ar       text NOT NULL,
  name_en       text NOT NULL,
  is_system     boolean NOT NULL DEFAULT false
);

CREATE TABLE role_permissions (
  role_id          uuid NOT NULL REFERENCES roles(id),
  permission_code  text NOT NULL REFERENCES permissions(code),
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE staff_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id),  -- NULL = NX super admin staff
  full_name     text NOT NULL,
  email         text NOT NULL,
  mobile        text,
  mfa_enabled   boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, email)
);

CREATE TABLE user_role_assignments (
  user_id          uuid NOT NULL REFERENCES staff_users(id),
  role_id          uuid NOT NULL REFERENCES roles(id),
  city_id          uuid REFERENCES cities(id),   -- optional scope: one city only
  vertical_id      uuid REFERENCES verticals(id),-- optional scope: one service only
  PRIMARY KEY (user_id, role_id)
);

-- Per-tenant message templates (push / SMS / email / WhatsApp) per stage.
CREATE TABLE notification_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  event_code    text NOT NULL,   -- stage code or system event
  channel       text NOT NULL,   -- push | sms | email | whatsapp
  locale        text NOT NULL,
  body          text NOT NULL,   -- supports {{order.ref}}, {{agent.name}}, {{eta}}
  UNIQUE (tenant_id, event_code, channel, locale)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workflow_definitions','workflow_stages']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_or_global ON %I USING (tenant_id IS NULL OR tenant_id = current_setting(''app.tenant_id'')::uuid)', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['tenant_template_installs','tenant_addons','tenant_entitlement_overrides',
                         'tenant_group_members','notification_templates']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'')::uuid)', t);
  END LOOP;
END $$;

-- =====================================================================
-- 10. UBER-STYLE PRICING, VEHICLE CATALOG, CITY AVAILABILITY
-- =====================================================================

-- ---------- 10a. City boundaries: detect the customer's city by GPS ----------
ALTER TABLE cities ADD COLUMN boundary geography(MultiPolygon, 4326);
CREATE INDEX cities_boundary_gix ON cities USING gist (boundary);

-- ---------- 10b. Vehicle catalog ----------
-- Global reference data maintained by NX super admin, shared by all tenants.
CREATE TABLE vehicle_makes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     text NOT NULL,
  name_en     text NOT NULL UNIQUE,          -- Honda
  logo_url    text,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE vehicle_body_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,          -- sedan, suv, pickup, van, coupe, truck
  name_ar     text NOT NULL,
  name_en     text NOT NULL
);

CREATE TABLE vehicle_models (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id         uuid NOT NULL REFERENCES vehicle_makes(id),
  name_ar         text NOT NULL,
  name_en         text NOT NULL,             -- Accord
  body_type_id    uuid NOT NULL REFERENCES vehicle_body_types(id),
  year_from       int,
  year_to         int,
  curb_weight_kg  int,                       -- helps match tow truck capacity
  drivetrain      text,                      -- fwd | rwd | awd (awd usually needs flatbed)
  default_class   text,                      -- suggested: economy | standard | luxury | exotic
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE (make_id, name_en, year_from)
);

-- Classes are per tenant (each business names and prices its own).
CREATE TABLE vehicle_classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  code        text NOT NULL,                 -- economy | luxury | exotic | heavy
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, code)
);

-- Tenant mapping of models to its classes (falls back to default_class).
CREATE TABLE vehicle_class_map (
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  model_id      uuid NOT NULL REFERENCES vehicle_models(id),
  class_id      uuid NOT NULL REFERENCES vehicle_classes(id),
  PRIMARY KEY (tenant_id, model_id)
);

-- Customer's saved vehicles (pick once, reuse on every order).
CREATE TABLE customer_vehicles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  customer_id   uuid NOT NULL REFERENCES customers(id),
  model_id      uuid REFERENCES vehicle_models(id),
  custom_label  text,
  year          int,
  color         text,
  plate         text,
  is_default    boolean NOT NULL DEFAULT false
);

-- Dynamic fields can point to reference catalogs (e.g. a "vehicle" field).
ALTER TYPE attr_type ADD VALUE IF NOT EXISTS 'reference';
ALTER TABLE attribute_definitions ADD COLUMN reference_source text;
  -- 'vehicle_model' | 'customer_vehicle' | 'item_catalog:<code>'

-- ---------- 10c. Service tiers (the cards the customer picks, like UberX/Comfort) ----------
CREATE TABLE service_tiers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  vertical_id        uuid NOT NULL REFERENCES verticals(id),
  category_id        uuid REFERENCES categories(id),
  code               text NOT NULL,          -- flatbed_std, flatbed_hydraulic, enclosed_luxury
  name_ar            text NOT NULL,
  name_en            text NOT NULL,
  description_ar     text,
  description_en     text,
  icon_url           text,
  required_capabilities jsonb NOT NULL DEFAULT '{}', -- matched to provider assets
                                             -- {"asset_type":["flatbed"],"hydraulic":true}
  allowed_vehicle_classes uuid[],            -- NULL = all classes
  pricing_mode       text NOT NULL DEFAULT 'upfront', -- upfront | metered | fixed | quote
  sort_order         int NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, vertical_id, code)
);

-- ---------- 10d. Where each service / tier is offered ----------
CREATE TABLE service_availability (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  vertical_id      uuid NOT NULL REFERENCES verticals(id),
  category_id      uuid REFERENCES categories(id),
  tier_id          uuid REFERENCES service_tiers(id),
  city_id          uuid NOT NULL REFERENCES cities(id),
  zone_id          uuid REFERENCES zones(id),  -- NULL = whole city
  operating_hours  jsonb,                      -- {"sun":[["00:00","23:59"]], ...} NULL = 24/7
  allow_intercity  boolean NOT NULL DEFAULT false, -- drop-off outside the city
  launch_at        timestamptz,
  is_active        boolean NOT NULL DEFAULT true
);

-- ---------- 10e. Rate cards (the numeric fields, per tier x city x zone x class) ----------
CREATE TABLE rate_cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  tier_id             uuid NOT NULL REFERENCES service_tiers(id),
  city_id             uuid NOT NULL REFERENCES cities(id),
  zone_id             uuid REFERENCES zones(id),
  vehicle_class_id    uuid REFERENCES vehicle_classes(id),  -- NULL = any class
  -- distance / time components (SAR)
  base_fare           numeric(10,2) NOT NULL DEFAULT 0,  -- fixed start amount
  booking_fee         numeric(10,2) NOT NULL DEFAULT 0,  -- per order, platform side
  included_km         numeric(8,2)  NOT NULL DEFAULT 0,  -- km covered by base fare
  per_km              numeric(10,3) NOT NULL DEFAULT 0,  -- loaded trip km
  approach_per_km     numeric(10,3) NOT NULL DEFAULT 0,  -- empty km to reach pickup
  approach_free_km    numeric(8,2)  NOT NULL DEFAULT 0,
  per_min             numeric(10,3) NOT NULL DEFAULT 0,  -- trip minutes
  free_wait_min       int           NOT NULL DEFAULT 0,
  per_wait_min        numeric(10,3) NOT NULL DEFAULT 0,  -- waiting at pickup
  flat_fare           numeric(10,2),                     -- used when pricing_mode = fixed
  minimum_fare        numeric(10,2) NOT NULL DEFAULT 0,
  maximum_fare        numeric(10,2),
  -- class adjustment when one card serves several classes
  class_multiplier    numeric(6,3)  NOT NULL DEFAULT 1,
  -- upfront pricing safety
  auth_buffer_pct     numeric(5,2)  NOT NULL DEFAULT 15, -- held above estimate
  reprice_threshold_pct numeric(5,2) NOT NULL DEFAULT 20, -- re-quote if actual route deviates more
  rounding            text NOT NULL DEFAULT 'nearest_1', -- none | nearest_0_5 | nearest_1 | up_5
  cancellation_fee    numeric(10,2) NOT NULL DEFAULT 0,
  cancellation_free_min int NOT NULL DEFAULT 2,
  -- lifecycle
  version             int NOT NULL DEFAULT 1,
  status              text NOT NULL DEFAULT 'draft',     -- draft | pending_approval | active | archived
  valid_from          timestamptz,
  valid_to            timestamptz,
  created_by          uuid,
  approved_by         uuid,
  approved_at         timestamptz,
  CHECK (approved_by IS NULL OR approved_by <> created_by)
);
CREATE INDEX rate_cards_lookup ON rate_cards (tenant_id, tier_id, city_id, status);

-- Extra charges triggered by order attributes (AWD needs flatbed, basement pickup...).
CREATE TABLE rate_card_modifiers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  rate_card_id  uuid NOT NULL REFERENCES rate_cards(id),
  name_ar       text NOT NULL,
  name_en       text NOT NULL,
  condition     jsonb NOT NULL,   -- {"key":"vehicle_condition","eq":"accident"}
  calc          fee_calc NOT NULL,
  rate_pct      numeric(6,3),
  fixed_amount  numeric(10,2)
);

-- ---------- 10f. Geographic pricing ----------
-- Surcharge for pickup or drop-off in a zone (airport, port, remote area).
CREATE TABLE zone_surcharges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  zone_id       uuid NOT NULL REFERENCES zones(id),
  tier_id       uuid REFERENCES service_tiers(id),   -- NULL = all tiers
  applies_on    text NOT NULL DEFAULT 'pickup',      -- pickup | dropoff | either
  calc          fee_calc NOT NULL,
  rate_pct      numeric(6,3),
  fixed_amount  numeric(10,2),
  is_active     boolean NOT NULL DEFAULT true
);

-- Fixed fares between two zones (e.g. airport -> city centre), overrides the formula.
CREATE TABLE zone_to_zone_fares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  tier_id       uuid NOT NULL REFERENCES service_tiers(id),
  from_zone_id  uuid NOT NULL REFERENCES zones(id),
  to_zone_id    uuid NOT NULL REFERENCES zones(id),
  vehicle_class_id uuid REFERENCES vehicle_classes(id),
  fare          numeric(10,2) NOT NULL,
  bidirectional boolean NOT NULL DEFAULT true,
  is_active     boolean NOT NULL DEFAULT true
);

-- ---------- 10g. Surge (peak) pricing ----------
-- Scheduled peaks: weekends, rush hours, Ramadan nights, events.
CREATE TABLE surge_schedules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  name          text NOT NULL,
  tier_id       uuid REFERENCES service_tiers(id),
  city_id       uuid REFERENCES cities(id),
  zone_id       uuid REFERENCES zones(id),
  days_of_week  int[],                   -- 0=Sun..6=Sat, NULL = every day
  time_from     time,
  time_to       time,
  date_from     date,                    -- seasonal windows
  date_to       date,
  multiplier    numeric(4,2) NOT NULL CHECK (multiplier >= 1),
  is_active     boolean NOT NULL DEFAULT true
);

-- Dynamic surge from live demand vs supply per zone.
CREATE TABLE surge_policies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  tier_id            uuid REFERENCES service_tiers(id),
  zone_id            uuid REFERENCES zones(id),
  steps              jsonb NOT NULL,
    -- ratio = open requests / available agents in zone (last N minutes)
    -- [{"ratio_gte":1.5,"multiplier":1.2},{"ratio_gte":2.5,"multiplier":1.5}]
  window_minutes     int NOT NULL DEFAULT 10,
  max_multiplier     numeric(4,2) NOT NULL DEFAULT 2.0,   -- hard cap
  min_hold_minutes   int NOT NULL DEFAULT 5,              -- avoid flapping
  combine_with_schedule text NOT NULL DEFAULT 'max',      -- max | multiply
  requires_customer_ack boolean NOT NULL DEFAULT true,    -- customer confirms surge
  is_active          boolean NOT NULL DEFAULT false
);

CREATE TABLE surge_snapshots (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  zone_id       uuid NOT NULL REFERENCES zones(id),
  tier_id       uuid REFERENCES service_tiers(id),
  demand        int NOT NULL,
  supply        int NOT NULL,
  multiplier    numeric(4,2) NOT NULL,
  computed_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- 10h. Price estimates (what the customer sees per tier card) ----------
CREATE TABLE price_estimates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  customer_id       uuid REFERENCES customers(id),
  tier_id           uuid NOT NULL REFERENCES service_tiers(id),
  rate_card_id      uuid REFERENCES rate_cards(id),
  origin            geography(Point, 4326),
  destination       geography(Point, 4326),
  vehicle_class_id  uuid REFERENCES vehicle_classes(id),
  route_distance_km numeric(8,2),          -- from routing API, not straight line
  route_duration_min numeric(8,2),
  approach_km       numeric(8,2),          -- nearest available agent to pickup
  surge_multiplier  numeric(4,2) NOT NULL DEFAULT 1,
  breakdown         jsonb NOT NULL,        -- every line: base, km, min, zone, surge, fees, VAT
  total             numeric(10,2) NOT NULL,
  auth_amount       numeric(10,2) NOT NULL, -- total + buffer, what gets authorized
  expires_at        timestamptz NOT NULL,  -- typically 5 minutes
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN tier_id uuid REFERENCES service_tiers(id);
ALTER TABLE orders ADD COLUMN price_estimate_id uuid REFERENCES price_estimates(id);
ALTER TABLE orders ADD COLUMN customer_vehicle_id uuid REFERENCES customer_vehicles(id);
ALTER TABLE orders ADD COLUMN vehicle_class_id uuid REFERENCES vehicle_classes(id);
ALTER TABLE orders ADD COLUMN actual_distance_km numeric(8,2);
ALTER TABLE orders ADD COLUMN actual_duration_min numeric(8,2);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vehicle_classes','vehicle_class_map','customer_vehicles','service_tiers',
    'service_availability','rate_cards','rate_card_modifiers','zone_surcharges',
    'zone_to_zone_fares','surge_schedules','surge_policies','surge_snapshots',
    'price_estimates']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'')::uuid)', t);
  END LOOP;
END $$;
-- vehicle_makes / vehicle_body_types / vehicle_models stay global (no RLS).

-- =====================================================================
-- 11. FLEXIBLE LICENCE BILLING (white-label plans)
-- A plan version's price = sum of components. Any mix of:
--   flat subscription, per provider, per agent, per order, % of GMV, add-on units.
-- =====================================================================
ALTER TABLE plan_versions DROP COLUMN monthly_price;
ALTER TABLE plan_versions DROP COLUMN yearly_price;
ALTER TABLE plan_versions DROP COLUMN txn_fee_pct;
ALTER TABLE plan_versions ADD COLUMN billing_interval text NOT NULL DEFAULT 'monthly'; -- monthly | quarterly | yearly
ALTER TABLE plan_versions ADD COLUMN yearly_discount_pct numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE plan_versions ADD COLUMN minimum_commitment numeric(12,2) NOT NULL DEFAULT 0; -- floor per interval
ALTER TABLE plan_versions ADD COLUMN currency char(3) NOT NULL DEFAULT 'SAR';

CREATE TYPE billing_metric AS ENUM (
  'flat',               -- fixed subscription
  'active_providers',   -- provider orgs with >= 1 order or active status in period
  'active_agents',      -- field workers (seats)
  'completed_orders',   -- captured orders in period
  'gmv',                -- captured order value in period (SAR)
  'cities',
  'service_modules',
  'branded_app_pairs',
  'api_calls',
  'sms_messages');

CREATE TYPE price_model AS ENUM (
  'flat',       -- fixed amount
  'per_unit',   -- quantity x unit_price (after included units)
  'graduated',  -- each bracket priced at its own rate (like tax brackets)
  'volume',     -- whole quantity priced at the bracket it lands in
  'package',    -- per block of N units (e.g. 50 SAR per 100 orders)
  'percent');   -- % of GMV

CREATE TABLE plan_price_components (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id  uuid NOT NULL REFERENCES plan_versions(id),
  metric           billing_metric NOT NULL,
  model            price_model NOT NULL,
  label_ar         text NOT NULL,
  label_en         text NOT NULL,
  amount           numeric(12,2),        -- flat amount
  unit_price       numeric(12,4),        -- per_unit / package price
  package_size     int,                  -- package model
  rate_pct         numeric(6,3),         -- percent model
  included_units   numeric(14,2) NOT NULL DEFAULT 0,  -- free quota before charging
  brackets         jsonb,
    -- graduated/volume: [{"up_to":100,"unit_price":2},{"up_to":1000,"unit_price":1.5},{"up_to":null,"unit_price":1}]
  min_charge       numeric(12,2),
  max_charge       numeric(12,2),        -- cap protects the tenant
  charge_timing    text NOT NULL DEFAULT 'arrears', -- advance (flat) | arrears (usage)
  hard_limit       boolean NOT NULL DEFAULT false,  -- true = block above included_units
  sort_order       int NOT NULL DEFAULT 0,
  CHECK (model <> 'flat'      OR amount IS NOT NULL),
  CHECK (model <> 'per_unit'  OR unit_price IS NOT NULL),
  CHECK (model <> 'package'   OR (unit_price IS NOT NULL AND package_size > 0)),
  CHECK (model <> 'percent'   OR rate_pct IS NOT NULL),
  CHECK (model NOT IN ('graduated','volume') OR brackets IS NOT NULL)
);

-- Metered usage, aggregated per tenant per period.
CREATE TABLE usage_records (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  metric        billing_metric NOT NULL,
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  quantity      numeric(16,2) NOT NULL,
  source        text NOT NULL DEFAULT 'system',  -- system | manual_adjustment
  computed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, metric, period_start, source)
);

CREATE TABLE tenant_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  subscription_id uuid REFERENCES tenant_subscriptions(id),
  number          text NOT NULL UNIQUE,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  subtotal        numeric(12,2) NOT NULL,
  vat             numeric(12,2) NOT NULL,
  total           numeric(12,2) NOT NULL,
  status          text NOT NULL DEFAULT 'draft', -- draft | issued | paid | overdue | void
  zatca_uuid      text,                          -- e-invoice reference
  payment_ref     text,                          -- Moyasar payment / tokenized card charge
  issued_at       timestamptz,
  due_at          timestamptz,
  paid_at         timestamptz
);

CREATE TABLE tenant_invoice_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES tenant_invoices(id),
  component_id    uuid REFERENCES plan_price_components(id),
  addon_id        uuid REFERENCES tenant_addons(id),
  description     text NOT NULL,
  quantity        numeric(16,2) NOT NULL DEFAULT 1,
  billable_qty    numeric(16,2) NOT NULL DEFAULT 1,  -- after included units
  unit_price      numeric(12,4),
  amount          numeric(12,2) NOT NULL,
  calc_details    jsonb                               -- bracket-by-bracket breakdown
);

-- Super admin can give a tenant a negotiated price on any component.
CREATE TABLE tenant_price_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  component_id    uuid NOT NULL REFERENCES plan_price_components(id),
  override        jsonb NOT NULL,     -- any subset of component fields
  reason          text NOT NULL,
  valid_from      date NOT NULL,
  valid_to        date
);

-- =====================================================================
-- 12. TENANT -> PROVIDER MEMBERSHIPS (the tenant monetises its providers)
-- Same metric / model enums as NX licence billing, one level down.
-- =====================================================================
CREATE TABLE provider_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  code             text NOT NULL,            -- free | basic | gold
  name_ar          text NOT NULL,
  name_en          text NOT NULL,
  description_ar   text,
  description_en   text,
  is_default       boolean NOT NULL DEFAULT false,  -- assigned on approval
  is_public        boolean NOT NULL DEFAULT true,   -- visible in provider app
  billing_interval text NOT NULL DEFAULT 'monthly',
  trial_days       int NOT NULL DEFAULT 0,
  collection_method text NOT NULL DEFAULT 'offset_from_earnings',
    -- offset_from_earnings: dues taken from the provider's next order splits
    -- card_on_file:         charge provider's tokenized card (tenant merchant account)
    -- invoice:              manual invoice / bank transfer
  version          int NOT NULL DEFAULT 1,
  status           text NOT NULL DEFAULT 'draft',   -- draft | active | retired
  UNIQUE (tenant_id, code, version)
);

CREATE TABLE provider_plan_price_components (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  provider_plan_id uuid NOT NULL REFERENCES provider_plans(id),
  metric           billing_metric NOT NULL,   -- flat | active_agents | completed_orders | gmv
  model            price_model NOT NULL,
  label_ar         text NOT NULL,
  label_en         text NOT NULL,
  amount           numeric(12,2),
  unit_price       numeric(12,4),
  package_size     int,
  rate_pct         numeric(6,3),
  included_units   numeric(14,2) NOT NULL DEFAULT 0,
  brackets         jsonb,
  min_charge       numeric(12,2),
  max_charge       numeric(12,2)
);

-- What a membership gives the provider (this is what makes paying worth it).
CREATE TABLE provider_plan_benefits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  provider_plan_id uuid NOT NULL REFERENCES provider_plans(id),
  benefit          text NOT NULL,
    -- fee_schedule       : value = fee_schedule_id (e.g. 8% commission instead of 15%)
    -- dispatch_boost     : value = ranking bonus in auto/broadcast dispatch
    -- max_categories     : value = number of categories allowed
    -- max_agents         : value = field workers allowed
    -- featured_listing   : appears first when customer chooses provider
    -- badge              : value = badge code shown to customers
    -- payout_schedule    : value = faster settlement option
    -- analytics          : advanced reports in provider portal
  value            jsonb NOT NULL DEFAULT 'true'
);

CREATE TABLE provider_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  org_id           uuid NOT NULL REFERENCES provider_orgs(id),
  provider_plan_id uuid NOT NULL REFERENCES provider_plans(id),
  status           text NOT NULL DEFAULT 'active', -- trial | active | past_due | suspended | cancelled
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  card_token_ref   text,                           -- card_on_file collection
  auto_renew       boolean NOT NULL DEFAULT true,
  cancelled_at     timestamptz
);

CREATE TABLE provider_invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  org_id           uuid NOT NULL REFERENCES provider_orgs(id),
  subscription_id  uuid REFERENCES provider_subscriptions(id),
  number           text NOT NULL,
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  subtotal         numeric(12,2) NOT NULL,
  vat              numeric(12,2) NOT NULL,
  total            numeric(12,2) NOT NULL,
  amount_settled   numeric(12,2) NOT NULL DEFAULT 0,  -- via offsets or card charges
  status           text NOT NULL DEFAULT 'issued',   -- issued | partially_paid | paid | overdue | void
  zatca_uuid       text,
  issued_at        timestamptz NOT NULL DEFAULT now(),
  due_at           timestamptz,
  UNIQUE (tenant_id, number)
);

-- Offsets: part of a provider split redirected to the tenant to settle dues.
-- Shown line by line in the provider's statement.
CREATE TABLE provider_dues_offsets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  invoice_id       uuid NOT NULL REFERENCES provider_invoices(id),
  payment_id       uuid NOT NULL REFERENCES payments(id),
  amount           numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 13. HIERARCHICAL SETTINGS WITH LOCKS
-- Resolution order: platform default -> plan -> tenant group -> tenant -> provider.
-- A higher level can LOCK a key so lower levels cannot change it,
-- or bound it (min/max) so lower levels choose within limits.
-- =====================================================================
CREATE TABLE setting_definitions (
  key              text PRIMARY KEY,      -- e.g. fees.max_customer_service_fee_pct,
                                          --      dispatch.offer_timeout_sec,
                                          --      providers.subscription_allowed,
                                          --      branding.hide_powered_by
  category         text NOT NULL,         -- branding | fees | dispatch | payments | compliance ...
  data_type        text NOT NULL,         -- boolean | number | text | json | enum
  enum_values      text[],
  default_value    jsonb NOT NULL,
  editable_levels  text[] NOT NULL,       -- which levels may set it: {tenant,provider}
  requires_module  text,                  -- shown only if this module is entitled
  description_ar   text,
  description_en   text
);

CREATE TABLE setting_values (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key              text NOT NULL REFERENCES setting_definitions(key),
  level            text NOT NULL CHECK (level IN ('platform','plan','tenant_group','tenant','provider')),
  owner_id         uuid,                  -- plan_version / group / tenant / provider org id
  tenant_id        uuid REFERENCES tenants(id),  -- for RLS on tenant & provider levels
  value            jsonb,
  min_value        numeric,               -- bounds for lower levels
  max_value        numeric,
  is_locked        boolean NOT NULL DEFAULT false,
  updated_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, level, owner_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'provider_plans','provider_plan_price_components','provider_plan_benefits',
    'provider_subscriptions','provider_invoices','provider_dues_offsets']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'')::uuid)', t);
  END LOOP;
END $$;
ALTER TABLE setting_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_or_upper ON setting_values
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid);
