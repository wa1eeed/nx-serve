-- =====================================================================
-- 0012 Licence billing: NX bills tenants (reference schema section 11).
-- Same billing engine as provider memberships (packages/domain/billing).
-- =====================================================================

CREATE TYPE billing_metric AS ENUM (
  'flat', 'active_providers', 'active_agents', 'completed_orders', 'gmv',
  'cities', 'service_modules', 'branded_app_pairs', 'api_calls', 'sms_messages');

CREATE TYPE price_model AS ENUM (
  'flat', 'per_unit', 'graduated', 'volume', 'package', 'percent');

-- Global: belongs to a plan version. A plan version price = sum of components.
CREATE TABLE plan_price_components (
  id               uuid PRIMARY KEY,
  plan_version_id  uuid NOT NULL REFERENCES plan_versions(id),
  metric           billing_metric NOT NULL,
  model            price_model NOT NULL,
  label            jsonb NOT NULL,
  amount_minor     bigint,
  unit_price       numeric(12,4),
  package_size     int,
  rate_pct         numeric(6,3),
  included_units   numeric(14,2) NOT NULL DEFAULT 0,
  brackets         jsonb,
  min_charge_minor bigint,
  max_charge_minor bigint,
  charge_timing    text NOT NULL DEFAULT 'arrears' CHECK (charge_timing IN ('advance', 'arrears')),
  hard_limit       boolean NOT NULL DEFAULT false,
  sort_order       int NOT NULL DEFAULT 0,
  CHECK (model <> 'flat' OR amount_minor IS NOT NULL),
  CHECK (model <> 'per_unit' OR unit_price IS NOT NULL),
  CHECK (model <> 'package' OR (unit_price IS NOT NULL AND package_size > 0)),
  CHECK (model <> 'percent' OR rate_pct IS NOT NULL),
  CHECK (model NOT IN ('graduated', 'volume') OR brackets IS NOT NULL)
);

CREATE TABLE usage_records (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  metric        billing_metric NOT NULL,
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  quantity      numeric(16,2) NOT NULL,
  source        text NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'manual_adjustment')),
  computed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, metric, period_start, source)
);
CREATE INDEX usage_records_tenant_idx ON usage_records (tenant_id);

CREATE TABLE tenant_invoices (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  subscription_id uuid,
  number          text NOT NULL,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  subtotal_minor  bigint NOT NULL,
  vat_minor       bigint NOT NULL,
  total_minor     bigint NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'SAR',
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'void')),
  zatca_uuid      text,
  payment_ref     text,
  issued_at       timestamptz,
  due_at          timestamptz,
  paid_at         timestamptz,
  UNIQUE (tenant_id, number),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, subscription_id) REFERENCES tenant_subscriptions (tenant_id, id)
);
CREATE INDEX tenant_invoices_tenant_idx ON tenant_invoices (tenant_id);

CREATE TABLE tenant_invoice_lines (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  invoice_id      uuid NOT NULL,
  component_id    uuid REFERENCES plan_price_components(id),
  addon_id        uuid,
  description     jsonb NOT NULL,
  quantity        numeric(16,2) NOT NULL DEFAULT 1,
  billable_qty    numeric(16,2) NOT NULL DEFAULT 1,
  unit_price      numeric(12,4),
  amount_minor    bigint NOT NULL,
  calc_details    jsonb,
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES tenant_invoices (tenant_id, id),
  FOREIGN KEY (tenant_id, addon_id) REFERENCES tenant_addons (tenant_id, id)
);
CREATE INDEX tenant_invoice_lines_tenant_idx ON tenant_invoice_lines (tenant_id);

CREATE TABLE tenant_price_overrides (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  component_id    uuid NOT NULL REFERENCES plan_price_components(id),
  override        jsonb NOT NULL,
  reason          text NOT NULL,
  valid_from      date NOT NULL,
  valid_to        date
);
CREATE INDEX tenant_price_overrides_tenant_idx ON tenant_price_overrides (tenant_id);

-- plan_price_components is global reference data: no RLS.
SELECT nx_enable_tenant_rls('usage_records');
SELECT nx_enable_tenant_rls('tenant_invoices');
SELECT nx_enable_tenant_rls('tenant_invoice_lines');
SELECT nx_enable_tenant_rls('tenant_price_overrides');
