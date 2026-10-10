-- Price estimates (docs/09 section 4): a stored, itemized estimate with a short
-- expiry. An upfront-priced order must reference a valid, unexpired estimate. The
-- estimate snapshots the inputs, the itemized breakdown, the totals in minor units,
-- and the rate-card and fee-schedule versions used, so a later price change does
-- not move a quoted price. Money is bigint minor units; the surge multiplier is
-- numeric. Tenant-scoped with RLS.

CREATE TABLE price_estimates (
  id                   uuid PRIMARY KEY,
  tenant_id            uuid NOT NULL REFERENCES tenants(id),
  vertical_id          uuid,
  category_id          uuid,
  tier_id              uuid,
  city_id              uuid,
  zone_id              uuid,
  vehicle_class_id     uuid,
  currency             char(3) NOT NULL DEFAULT 'SAR',
  -- Resolved inputs (distance, duration, approach, stops, attributes) and the
  -- itemized fare and fee lines, as computed by the domain engines.
  inputs               jsonb NOT NULL,
  breakdown            jsonb NOT NULL,
  service_fare_minor   bigint NOT NULL,
  customer_total_minor bigint NOT NULL,
  authorized_minor     bigint NOT NULL,
  surge_multiplier     numeric(4,2) NOT NULL DEFAULT 1,
  -- Snapshot references to the versions used (not foreign keys: a card may later
  -- be archived while a quoted estimate must still resolve).
  rate_card_id         uuid,
  rate_card_version    int,
  fee_schedule_id      uuid,
  fee_schedule_version int,
  expires_at           timestamptz NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE INDEX price_estimates_lookup ON price_estimates (tenant_id, created_at);

SELECT nx_enable_tenant_rls('price_estimates');

-- The deferred foreign key from orders to the estimate it was priced from.
ALTER TABLE orders
  ADD CONSTRAINT orders_price_estimate_fk
  FOREIGN KEY (tenant_id, price_estimate_id) REFERENCES price_estimates (tenant_id, id);
