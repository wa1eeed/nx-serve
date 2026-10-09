-- =====================================================================
-- 0011 Modules, plans, entitlements, roles and permissions (reference 9b, 9c).
-- Modules, plans, limits and permissions are global reference data. Tenant
-- addons, overrides, roles, staff, assignments and notification templates are
-- tenant scoped. Effective access = tenant entitlement AND user permission.
-- =====================================================================

CREATE TABLE modules (
  id            uuid PRIMARY KEY,
  code          text NOT NULL UNIQUE,
  kind          text NOT NULL CHECK (kind IN ('service', 'capability')),
  name          jsonb NOT NULL,
  description   jsonb,
  template_id   uuid REFERENCES service_templates(id),
  is_published  boolean NOT NULL DEFAULT false,
  CHECK (kind = 'capability' OR template_id IS NOT NULL)
);

CREATE TABLE module_dependencies (
  module_id      uuid NOT NULL REFERENCES modules(id),
  requires_id    uuid NOT NULL REFERENCES modules(id),
  is_hard        boolean NOT NULL DEFAULT true,
  PRIMARY KEY (module_id, requires_id),
  CHECK (module_id <> requires_id)
);

CREATE TABLE limit_definitions (
  code          text PRIMARY KEY,
  name          jsonb NOT NULL,
  unit          text NOT NULL DEFAULT 'count'
);

CREATE TABLE plans (
  id            uuid PRIMARY KEY,
  code          text NOT NULL UNIQUE,
  name          jsonb NOT NULL,
  is_public     boolean NOT NULL DEFAULT true,
  group_id      uuid REFERENCES tenant_groups(id),
  sort_order    int NOT NULL DEFAULT 0
);

CREATE TABLE plan_versions (
  id               uuid PRIMARY KEY,
  plan_id          uuid NOT NULL REFERENCES plans(id),
  version          int NOT NULL,
  setup_fee_minor  bigint NOT NULL DEFAULT 0,
  trial_days       int NOT NULL DEFAULT 0,
  all_service_modules boolean NOT NULL DEFAULT false,
  billing_interval text NOT NULL DEFAULT 'monthly'
                   CHECK (billing_interval IN ('monthly', 'quarterly', 'yearly')),
  yearly_discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  minimum_commitment_minor bigint NOT NULL DEFAULT 0,
  currency         char(3) NOT NULL DEFAULT 'SAR',
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
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
  value            int,
  PRIMARY KEY (plan_version_id, limit_code)
);

CREATE TABLE addon_products (
  id            uuid PRIMARY KEY,
  code          text NOT NULL UNIQUE,
  module_id     uuid REFERENCES modules(id),
  limit_code    text REFERENCES limit_definitions(code),
  limit_delta   int,
  monthly_price_minor bigint NOT NULL,
  currency      char(3) NOT NULL DEFAULT 'SAR',
  CHECK (module_id IS NOT NULL OR limit_code IS NOT NULL)
);

CREATE TABLE tenant_addons (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  addon_id      uuid NOT NULL REFERENCES addon_products(id),
  quantity      int NOT NULL DEFAULT 1,
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz,
  UNIQUE (tenant_id, id)
);
CREATE INDEX tenant_addons_tenant_idx ON tenant_addons (tenant_id);

CREATE TABLE tenant_entitlement_overrides (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  module_id     uuid REFERENCES modules(id),
  limit_code    text REFERENCES limit_definitions(code),
  enabled       boolean,
  value         int,
  reason        text NOT NULL,
  expires_at    timestamptz,
  created_by    uuid,
  CHECK (module_id IS NOT NULL OR limit_code IS NOT NULL)
);
CREATE INDEX tenant_entitlement_overrides_tenant_idx ON tenant_entitlement_overrides (tenant_id);

CREATE TABLE tenant_subscriptions (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  plan_version_id uuid NOT NULL REFERENCES plan_versions(id),
  billing_cycle   text NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  status          text NOT NULL DEFAULT 'active',
  UNIQUE (tenant_id, id)
);
CREATE INDEX tenant_subscriptions_tenant_idx ON tenant_subscriptions (tenant_id);

CREATE TABLE permissions (
  code          text PRIMARY KEY,
  module_code   text,
  description   jsonb
);

CREATE TABLE roles (
  id            uuid PRIMARY KEY,
  tenant_id     uuid REFERENCES tenants(id),   -- NULL = NX system role template
  scope         text NOT NULL CHECK (scope IN ('platform', 'tenant', 'provider_org')),
  code          text NOT NULL,
  name          jsonb NOT NULL,
  is_system     boolean NOT NULL DEFAULT false
);
CREATE INDEX roles_tenant_idx ON roles (tenant_id);

CREATE TABLE role_permissions (
  tenant_id        uuid,
  role_id          uuid NOT NULL REFERENCES roles(id),
  permission_code  text NOT NULL REFERENCES permissions(code),
  PRIMARY KEY (role_id, permission_code)
);
CREATE INDEX role_permissions_tenant_idx ON role_permissions (tenant_id);

CREATE TABLE staff_users (
  id            uuid PRIMARY KEY,
  tenant_id     uuid REFERENCES tenants(id),   -- NULL = NX super admin staff
  full_name     text NOT NULL,
  email         text NOT NULL,
  mobile        text,
  mfa_enabled   boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, id)
);
CREATE INDEX staff_users_tenant_idx ON staff_users (tenant_id);

CREATE TABLE user_role_assignments (
  tenant_id        uuid,
  user_id          uuid NOT NULL REFERENCES staff_users(id),
  role_id          uuid NOT NULL REFERENCES roles(id),
  city_id          uuid REFERENCES cities(id),
  vertical_id      uuid,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX user_role_assignments_tenant_idx ON user_role_assignments (tenant_id);

CREATE TABLE notification_templates (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  event_code    text NOT NULL,
  channel       text NOT NULL CHECK (channel IN ('push', 'sms', 'email', 'whatsapp', 'inapp')),
  locale        text NOT NULL,
  body          text NOT NULL,
  UNIQUE (tenant_id, event_code, channel, locale)
);
CREATE INDEX notification_templates_tenant_idx ON notification_templates (tenant_id);

-- RLS. Global reference tables (modules, plans, permissions, limits) have no RLS.
SELECT nx_enable_tenant_rls('tenant_addons');
SELECT nx_enable_tenant_rls('tenant_entitlement_overrides');
SELECT nx_enable_tenant_rls('tenant_subscriptions');
SELECT nx_enable_tenant_or_global_rls('roles');
SELECT nx_enable_tenant_or_global_rls('role_permissions');
SELECT nx_enable_tenant_rls('staff_users');
SELECT nx_enable_tenant_rls('user_role_assignments');
SELECT nx_enable_tenant_rls('notification_templates');
