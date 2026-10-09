-- =====================================================================
-- 0002 Multi-tenancy core (reference schema section 8).
-- NX runs its own brand as a tenant with is_platform_owner = true.
-- =====================================================================

CREATE TABLE tenants (
  id                 uuid PRIMARY KEY,
  slug               text NOT NULL UNIQUE
                     CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  legal_name         text NOT NULL,
  display_name       text NOT NULL,
  status             text NOT NULL DEFAULT 'trial'
                     CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
  is_platform_owner  boolean NOT NULL DEFAULT false,
  country_code       char(2) NOT NULL DEFAULT 'SA',
  currency           char(3) NOT NULL DEFAULT 'SAR',
  default_locale     text NOT NULL DEFAULT 'ar',
  supported_locales  text[] NOT NULL DEFAULT '{ar,en}',
  branding           jsonb NOT NULL DEFAULT '{}',
  settings           jsonb NOT NULL DEFAULT '{}',
  nx_verify_ref      text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_domains (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  hostname            text NOT NULL UNIQUE,
  kind                text NOT NULL CHECK (kind IN ('subdomain', 'custom')),
  purpose             text NOT NULL DEFAULT 'website'
                      CHECK (purpose IN ('website', 'admin', 'provider_portal', 'api')),
  verification_token  text,
  verified_at         timestamptz,
  ssl_status          text NOT NULL DEFAULT 'pending'
                      CHECK (ssl_status IN ('pending', 'active', 'failed')),
  apple_pay_merchant_id text,
  apple_pay_verified_at timestamptz,
  is_primary          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX tenant_domains_tenant_idx ON tenant_domains (tenant_id);

CREATE TABLE tenant_payment_gateways (
  id                     uuid PRIMARY KEY,
  tenant_id              uuid NOT NULL REFERENCES tenants(id),
  gateway                text NOT NULL DEFAULT 'moyasar',
  mode                   text NOT NULL CHECK (mode IN ('own_platform', 'nx_master')),
  credentials_ref        text,
  platform_recipient_id  text,
  environment            text NOT NULL DEFAULT 'sandbox'
                         CHECK (environment IN ('sandbox', 'live')),
  status                 text NOT NULL DEFAULT 'pending',
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, gateway, environment),
  UNIQUE (tenant_id, id)
);
CREATE INDEX tenant_payment_gateways_tenant_idx ON tenant_payment_gateways (tenant_id);

CREATE TABLE tenant_apps (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  app_kind         text NOT NULL CHECK (app_kind IN ('customer', 'provider')),
  distribution     text NOT NULL DEFAULT 'web' CHECK (distribution IN ('web', 'branded')),
  app_name         jsonb,
  ios_bundle_id    text,
  android_package  text,
  icon_url         text,
  splash           jsonb,
  theme            jsonb,
  store_accounts   jsonb,
  build_status     text NOT NULL DEFAULT 'not_configured',
  current_version  text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, app_kind),
  UNIQUE (tenant_id, ios_bundle_id),
  UNIQUE (tenant_id, android_package),
  UNIQUE (tenant_id, id)
);
CREATE INDEX tenant_apps_tenant_idx ON tenant_apps (tenant_id);

CREATE TABLE app_builds (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  tenant_app_id  uuid NOT NULL,
  platform       text NOT NULL CHECK (platform IN ('ios', 'android')),
  version        text NOT NULL,
  build_number   int NOT NULL,
  ci_build_id    text,
  status         text NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued', 'building', 'submitted', 'failed')),
  log_url        text,
  started_at     timestamptz,
  finished_at    timestamptz,
  FOREIGN KEY (tenant_id, tenant_app_id) REFERENCES tenant_apps (tenant_id, id)
);
CREATE INDEX app_builds_tenant_idx ON app_builds (tenant_id);

CREATE TABLE api_clients (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  name               text NOT NULL,
  client_id          text NOT NULL UNIQUE,
  secret_hash        text NOT NULL,
  scopes             text[] NOT NULL DEFAULT '{}',
  environment        text NOT NULL DEFAULT 'sandbox'
                     CHECK (environment IN ('sandbox', 'live')),
  ip_allowlist       text[] NOT NULL DEFAULT '{}',
  rate_limit_per_min int NOT NULL DEFAULT 120,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_used_at       timestamptz,
  UNIQUE (tenant_id, id)
);
CREATE INDEX api_clients_tenant_idx ON api_clients (tenant_id);

CREATE TABLE webhook_subscriptions (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  url         text NOT NULL,
  events      text[] NOT NULL,
  secret_hash text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX webhook_subscriptions_tenant_idx ON webhook_subscriptions (tenant_id);

-- Tenant groups are global (reseller, enterprise, beta, government).
CREATE TABLE tenant_groups (
  id            uuid PRIMARY KEY,
  code          text NOT NULL UNIQUE,
  name          jsonb NOT NULL,
  description   jsonb,
  settings      jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE tenant_group_members (
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  group_id      uuid NOT NULL REFERENCES tenant_groups(id),
  PRIMARY KEY (group_id, tenant_id)
);
CREATE INDEX tenant_group_members_tenant_idx ON tenant_group_members (tenant_id);

-- RLS. tenants itself is restricted so a request only sees its own tenant row.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON tenants
  USING (id = nx_current_tenant())
  WITH CHECK (id = nx_current_tenant());

SELECT nx_enable_tenant_rls('tenant_domains');
SELECT nx_enable_tenant_rls('tenant_payment_gateways');
SELECT nx_enable_tenant_rls('tenant_apps');
SELECT nx_enable_tenant_rls('app_builds');
SELECT nx_enable_tenant_rls('api_clients');
SELECT nx_enable_tenant_rls('webhook_subscriptions');
SELECT nx_enable_tenant_rls('tenant_group_members');
-- tenant_groups is global reference data (no tenant_id): no RLS.
