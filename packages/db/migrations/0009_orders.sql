-- =====================================================================
-- 0009 Orders (reference schema section 6) with the stops model (ADR-0014).
-- orders.origin and destination are replaced by order_stops; the first and last
-- stop derive them. order_events and tracking_points are partitioned by month.
-- =====================================================================

CREATE TABLE customers (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  full_name   text,
  mobile      text NOT NULL,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- The same phone may exist in several tenants (docs/20), so mobile is unique per tenant.
  UNIQUE (tenant_id, mobile),
  UNIQUE (tenant_id, id)
);
CREATE INDEX customers_tenant_idx ON customers (tenant_id);

CREATE TABLE customer_vehicles (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  customer_id   uuid NOT NULL,
  model_id      uuid REFERENCES vehicle_models(id),
  custom_label  text,
  year          int,
  color         text,
  plate         text,
  is_default    boolean NOT NULL DEFAULT false,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id)
);
CREATE INDEX customer_vehicles_tenant_idx ON customer_vehicles (tenant_id);

CREATE TABLE orders (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  reference           text NOT NULL,
  customer_id         uuid NOT NULL,
  vertical_id         uuid NOT NULL,
  category_id         uuid,
  city_id             uuid REFERENCES cities(id),
  zone_id             uuid,
  tier_id             uuid,
  fulfillment         fulfillment_mode NOT NULL,
  tracking            tracking_mode NOT NULL,
  timing_type         text NOT NULL DEFAULT 'now'
                      CHECK (timing_type IN ('now', 'scheduled', 'flexible_window')),
  window_start        timestamptz,
  window_end          timestamptz,
  onsite_contact      jsonb,
  customer_notes      text,
  source_channel      text,
  terms_accepted_at   timestamptz,
  attributes          jsonb NOT NULL DEFAULT '{}',
  pricing_rule_id     uuid,
  pricing_snapshot    jsonb,
  dispatch_policy_id  uuid,
  price_estimate_id   uuid,              -- FK added in 0007-derived estimates (0009b not needed)
  payment_plan_id     uuid,              -- FK added in 0010
  customer_vehicle_id uuid,
  vehicle_class_id    uuid,
  estimated_amount_minor bigint,
  final_amount_minor  bigint,
  actual_distance_km  numeric(8,2),
  actual_duration_min numeric(8,2),
  currency            char(3) NOT NULL DEFAULT 'SAR',
  status              order_status NOT NULL DEFAULT 'draft',
  assigned_org_id     uuid,
  assigned_agent_id   uuid,
  asset_id            uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id),
  FOREIGN KEY (tenant_id, tier_id) REFERENCES service_tiers (tenant_id, id),
  FOREIGN KEY (tenant_id, pricing_rule_id) REFERENCES pricing_rules (tenant_id, id),
  FOREIGN KEY (tenant_id, dispatch_policy_id) REFERENCES dispatch_policies (tenant_id, id),
  FOREIGN KEY (tenant_id, customer_vehicle_id) REFERENCES customer_vehicles (tenant_id, id),
  FOREIGN KEY (tenant_id, vehicle_class_id) REFERENCES vehicle_classes (tenant_id, id),
  FOREIGN KEY (tenant_id, assigned_org_id) REFERENCES provider_orgs (tenant_id, id),
  FOREIGN KEY (tenant_id, assigned_agent_id) REFERENCES provider_agents (tenant_id, id),
  FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id)
);
CREATE INDEX orders_tenant_idx ON orders (tenant_id);
CREATE INDEX orders_attrs_gin ON orders USING gin (attributes);
CREATE INDEX orders_status_zone ON orders (tenant_id, status, zone_id);

-- Stops model (docs/25 B1, ADR-0014): every order is an ordered list of stops.
CREATE TABLE order_stops (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  order_id      uuid NOT NULL,
  sequence      int NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('pickup', 'dropoff', 'service', 'waypoint')),
  location      geography(Point, 4326),
  address       jsonb,
  contact       jsonb,
  window_start  timestamptz,
  window_end    timestamptz,
  instructions  text,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'arrived', 'done', 'skipped', 'failed')),
  arrived_at    timestamptz,
  completed_at  timestamptz,
  proof         jsonb,
  otp_hash      text,
  items         jsonb,
  UNIQUE (tenant_id, order_id, sequence),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id)
);
CREATE INDEX order_stops_tenant_idx ON order_stops (tenant_id);
CREATE INDEX order_stops_location_gix ON order_stops USING gist (location);

CREATE TABLE order_items (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  order_id        uuid NOT NULL,
  attribute_key   text NOT NULL,
  catalog_item_id uuid,
  custom_name     text,
  quantity        int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  details         jsonb NOT NULL DEFAULT '{}',
  CHECK (catalog_item_id IS NOT NULL OR custom_name IS NOT NULL),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
  FOREIGN KEY (tenant_id, catalog_item_id) REFERENCES catalog_items (tenant_id, id)
);
CREATE INDEX order_items_tenant_idx ON order_items (tenant_id);

CREATE TABLE order_addons (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  order_id      uuid NOT NULL,
  addon_id      uuid NOT NULL,
  quantity      int NOT NULL DEFAULT 1,
  unit_price_minor bigint NOT NULL,
  total_price_minor bigint NOT NULL,
  currency      char(3) NOT NULL DEFAULT 'SAR',
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
  FOREIGN KEY (tenant_id, addon_id) REFERENCES provider_addons (tenant_id, id)
);
CREATE INDEX order_addons_tenant_idx ON order_addons (tenant_id);

CREATE TABLE dispatch_offers (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  order_id      uuid NOT NULL,
  agent_id      uuid NOT NULL,
  round         int NOT NULL DEFAULT 1,
  distance_m    int,
  status        text NOT NULL DEFAULT 'sent'
                CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'cancelled')),
  sent_at       timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
  FOREIGN KEY (tenant_id, agent_id) REFERENCES provider_agents (tenant_id, id)
);
CREATE INDEX dispatch_offers_tenant_idx ON dispatch_offers (tenant_id);

CREATE TABLE quotes (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  order_id        uuid NOT NULL,
  org_id          uuid NOT NULL,
  agent_id        uuid,
  parent_quote_id uuid,
  offered_by      text NOT NULL CHECK (offered_by IN ('provider', 'customer')),
  amount_minor    bigint NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'SAR',
  eta_minutes     int,
  note            text,
  status          text NOT NULL DEFAULT 'offered'
                  CHECK (status IN ('offered', 'accepted', 'rejected', 'expired')),
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
  FOREIGN KEY (tenant_id, org_id) REFERENCES provider_orgs (tenant_id, id),
  FOREIGN KEY (tenant_id, agent_id) REFERENCES provider_agents (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_quote_id) REFERENCES quotes (tenant_id, id)
);
CREATE INDEX quotes_tenant_idx ON quotes (tenant_id);

CREATE TABLE order_media (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  order_id    uuid NOT NULL,
  stop_id     uuid,
  kind        text NOT NULL,
  url         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
  FOREIGN KEY (tenant_id, stop_id) REFERENCES order_stops (tenant_id, id)
);
CREATE INDEX order_media_tenant_idx ON order_media (tenant_id);

-- Partitioned state machine audit trail. A DEFAULT partition catches all rows;
-- a worker creates monthly partitions and drops old ones per retention (docs/13).
CREATE TABLE order_events (
  id          uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  order_id    uuid NOT NULL,
  from_status order_status,
  to_status   order_status NOT NULL,
  actor_type  text NOT NULL CHECK (actor_type IN ('customer', 'agent', 'ops', 'system')),
  actor_id    uuid,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE TABLE order_events_default PARTITION OF order_events DEFAULT;
CREATE INDEX order_events_tenant_idx ON order_events (tenant_id, order_id, created_at);

CREATE TABLE tracking_points (
  id          uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  order_id    uuid NOT NULL,
  agent_id    uuid NOT NULL,
  location    geography(Point, 4326) NOT NULL,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);
CREATE TABLE tracking_points_default PARTITION OF tracking_points DEFAULT;
CREATE INDEX tracking_points_tenant_idx ON tracking_points (tenant_id, order_id, recorded_at);
CREATE INDEX tracking_points_loc_gix ON tracking_points USING gist (location);

SELECT nx_enable_tenant_rls('customers');
SELECT nx_enable_tenant_rls('customer_vehicles');
SELECT nx_enable_tenant_rls('orders');
SELECT nx_enable_tenant_rls('order_stops');
SELECT nx_enable_tenant_rls('order_items');
SELECT nx_enable_tenant_rls('order_addons');
SELECT nx_enable_tenant_rls('dispatch_offers');
SELECT nx_enable_tenant_rls('quotes');
SELECT nx_enable_tenant_rls('order_media');
SELECT nx_enable_tenant_rls('order_events');
SELECT nx_enable_tenant_rls('tracking_points');
