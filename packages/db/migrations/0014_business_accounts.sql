-- =====================================================================
-- 0014 Business accounts (docs/25 B5). B2B customers (insurers, fleets,
-- shippers, merchants) order with negotiated prices and monthly statements.
-- Data model lands now; billing UI is Phase 7.
-- =====================================================================

CREATE TABLE customer_accounts (
  id                uuid PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  legal_name        text NOT NULL,
  cr_number         text,
  vat_number        text,
  credit_limit_minor bigint NOT NULL DEFAULT 0,
  currency          char(3) NOT NULL DEFAULT 'SAR',
  payment_plan_id   uuid,
  billing_cycle     text NOT NULL DEFAULT 'monthly',
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'closed')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, payment_plan_id) REFERENCES payment_plans (tenant_id, id)
);
CREATE INDEX customer_accounts_tenant_idx ON customer_accounts (tenant_id);

CREATE TABLE customer_account_users (
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  account_id    uuid NOT NULL,
  customer_id   uuid NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'requester', 'approver')),
  cost_center   text,
  PRIMARY KEY (account_id, customer_id),
  FOREIGN KEY (tenant_id, account_id) REFERENCES customer_accounts (tenant_id, id),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id)
);
CREATE INDEX customer_account_users_tenant_idx ON customer_account_users (tenant_id);

CREATE TABLE account_rate_overrides (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  account_id      uuid NOT NULL,
  rate_card_id    uuid,
  fee_schedule_id uuid,
  override        jsonb NOT NULL,
  CHECK (rate_card_id IS NOT NULL OR fee_schedule_id IS NOT NULL),
  FOREIGN KEY (tenant_id, account_id) REFERENCES customer_accounts (tenant_id, id),
  FOREIGN KEY (tenant_id, rate_card_id) REFERENCES rate_cards (tenant_id, id),
  FOREIGN KEY (tenant_id, fee_schedule_id) REFERENCES fee_schedules (tenant_id, id)
);
CREATE INDEX account_rate_overrides_tenant_idx ON account_rate_overrides (tenant_id);

-- Link business account orders back to their account (nullable for individuals).
ALTER TABLE orders ADD COLUMN customer_account_id uuid;
ALTER TABLE orders
  ADD CONSTRAINT orders_customer_account_fk
  FOREIGN KEY (tenant_id, customer_account_id) REFERENCES customer_accounts (tenant_id, id);

SELECT nx_enable_tenant_rls('customer_accounts');
SELECT nx_enable_tenant_rls('customer_account_users');
SELECT nx_enable_tenant_rls('account_rate_overrides');
