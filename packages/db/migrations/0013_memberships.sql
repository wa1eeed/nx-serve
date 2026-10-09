-- =====================================================================
-- 0013 Tenant to provider memberships (reference schema section 12).
-- The tenant monetises its providers; same billing engine, one level down.
-- =====================================================================

CREATE TABLE provider_plans (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  code             text NOT NULL,
  name             jsonb NOT NULL,
  description      jsonb,
  is_default       boolean NOT NULL DEFAULT false,
  is_public        boolean NOT NULL DEFAULT true,
  billing_interval text NOT NULL DEFAULT 'monthly',
  trial_days       int NOT NULL DEFAULT 0,
  collection_method text NOT NULL DEFAULT 'offset_from_earnings'
                   CHECK (collection_method IN ('offset_from_earnings', 'card_on_file', 'invoice')),
  version          int NOT NULL DEFAULT 1,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  UNIQUE (tenant_id, code, version),
  UNIQUE (tenant_id, id)
);
CREATE INDEX provider_plans_tenant_idx ON provider_plans (tenant_id);

CREATE TABLE provider_plan_price_components (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  provider_plan_id uuid NOT NULL,
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
  FOREIGN KEY (tenant_id, provider_plan_id) REFERENCES provider_plans (tenant_id, id)
);
CREATE INDEX provider_plan_price_components_tenant_idx ON provider_plan_price_components (tenant_id);

CREATE TABLE provider_plan_benefits (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  provider_plan_id uuid NOT NULL,
  benefit          text NOT NULL,
  value            jsonb NOT NULL DEFAULT 'true',
  FOREIGN KEY (tenant_id, provider_plan_id) REFERENCES provider_plans (tenant_id, id)
);
CREATE INDEX provider_plan_benefits_tenant_idx ON provider_plan_benefits (tenant_id);

CREATE TABLE provider_subscriptions (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  org_id           uuid NOT NULL,
  provider_plan_id uuid NOT NULL,
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  card_token_ref   text,
  auto_renew       boolean NOT NULL DEFAULT true,
  cancelled_at     timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, org_id) REFERENCES provider_orgs (tenant_id, id),
  FOREIGN KEY (tenant_id, provider_plan_id) REFERENCES provider_plans (tenant_id, id)
);
CREATE INDEX provider_subscriptions_tenant_idx ON provider_subscriptions (tenant_id);

CREATE TABLE provider_invoices (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  org_id           uuid NOT NULL,
  subscription_id  uuid,
  number           text NOT NULL,
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  subtotal_minor   bigint NOT NULL,
  vat_minor        bigint NOT NULL,
  total_minor      bigint NOT NULL,
  amount_settled_minor bigint NOT NULL DEFAULT 0,
  currency         char(3) NOT NULL DEFAULT 'SAR',
  status           text NOT NULL DEFAULT 'issued'
                   CHECK (status IN ('issued', 'partially_paid', 'paid', 'overdue', 'void')),
  zatca_uuid       text,
  issued_at        timestamptz NOT NULL DEFAULT now(),
  due_at           timestamptz,
  UNIQUE (tenant_id, number),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, org_id) REFERENCES provider_orgs (tenant_id, id),
  FOREIGN KEY (tenant_id, subscription_id) REFERENCES provider_subscriptions (tenant_id, id)
);
CREATE INDEX provider_invoices_tenant_idx ON provider_invoices (tenant_id);

CREATE TABLE provider_dues_offsets (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  invoice_id       uuid NOT NULL,
  payment_id       uuid NOT NULL,
  amount_minor     bigint NOT NULL CHECK (amount_minor > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES provider_invoices (tenant_id, id),
  FOREIGN KEY (tenant_id, payment_id) REFERENCES payments (tenant_id, id)
);
CREATE INDEX provider_dues_offsets_tenant_idx ON provider_dues_offsets (tenant_id);

SELECT nx_enable_tenant_rls('provider_plans');
SELECT nx_enable_tenant_rls('provider_plan_price_components');
SELECT nx_enable_tenant_rls('provider_plan_benefits');
SELECT nx_enable_tenant_rls('provider_subscriptions');
SELECT nx_enable_tenant_rls('provider_invoices');
SELECT nx_enable_tenant_rls('provider_dues_offsets');
