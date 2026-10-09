-- =====================================================================
-- 0010 Payments (reference schema section 7) and payment plans (docs/25 B2).
-- Money is bigint minor units. Splits sum to the payment amount; the splits
-- domain lives in packages/domain and is gateway agnostic. Payments are sandbox
-- only and behind a feature flag until the Moyasar addendum (docs/16 Q1, Q6).
-- =====================================================================

CREATE TYPE payment_status AS ENUM (
  'initiated', 'authorized', 'captured', 'partially_captured', 'voided',
  'refunded', 'partially_refunded', 'failed', 'expired');

CREATE TABLE payment_plans (
  id        uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code      text NOT NULL,
  kind      text NOT NULL CHECK (kind IN (
              'authorize_capture', 'prepay', 'deposit_then_balance', 'milestones',
              'invoice', 'reimbursable_purchase', 'cash_on_delivery')),
  params    jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);
CREATE INDEX payment_plans_tenant_idx ON payment_plans (tenant_id);

CREATE TABLE payment_milestones (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  plan_id     uuid NOT NULL,
  stage_code  text NOT NULL,
  kind        text NOT NULL CHECK (kind IN (
                'authorize', 'capture', 'capture_pct', 'deposit', 'supplement')),
  pct         numeric(5,2),
  fixed_minor bigint,
  sort_order  int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, plan_id) REFERENCES payment_plans (tenant_id, id)
);
CREATE INDEX payment_milestones_tenant_idx ON payment_milestones (tenant_id);

-- Bind tiers and orders to a payment plan now that the table exists.
ALTER TABLE service_tiers
  ADD CONSTRAINT service_tiers_payment_plan_fk
  FOREIGN KEY (tenant_id, payment_plan_id) REFERENCES payment_plans (tenant_id, id);
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_plan_fk
  FOREIGN KEY (tenant_id, payment_plan_id) REFERENCES payment_plans (tenant_id, id);

CREATE TABLE payments (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  order_id            uuid NOT NULL,
  purpose             text NOT NULL DEFAULT 'main'
                      CHECK (purpose IN ('main', 'supplement', 'cancellation_fee', 'deposit')),
  moyasar_payment_id  text,
  moyasar_merchant_id text,
  method              text,
  card_token_ref      text,
  authorized_amount_minor bigint,
  captured_amount_minor   bigint NOT NULL DEFAULT 0,
  refunded_amount_minor   bigint NOT NULL DEFAULT 0,
  currency            char(3) NOT NULL DEFAULT 'SAR',
  status              payment_status NOT NULL DEFAULT 'initiated',
  auth_expires_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, moyasar_payment_id),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id)
);
CREATE INDEX payments_tenant_idx ON payments (tenant_id);

CREATE TABLE payment_splits (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  payment_id      uuid NOT NULL,
  recipient_type  text NOT NULL CHECK (recipient_type IN ('provider', 'platform', 'beneficiary')),
  recipient_ref   text NOT NULL,
  amount_minor    bigint NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'SAR',
  is_fee_source   boolean NOT NULL DEFAULT false,
  refundable      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, payment_id) REFERENCES payments (tenant_id, id)
);
CREATE INDEX payment_splits_tenant_idx ON payment_splits (tenant_id);

-- Inbound gateway webhooks, processed exactly once. event_id is unique per
-- tenant and gateway account (docs/04 rule 4).
CREATE TABLE webhook_events (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  source        text NOT NULL DEFAULT 'moyasar',
  event_id      text NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  UNIQUE (tenant_id, source, event_id)
);
CREATE INDEX webhook_events_tenant_idx ON webhook_events (tenant_id);

SELECT nx_enable_tenant_rls('payment_plans');
SELECT nx_enable_tenant_rls('payment_milestones');
SELECT nx_enable_tenant_rls('payments');
SELECT nx_enable_tenant_rls('payment_splits');
SELECT nx_enable_tenant_rls('webhook_events');
