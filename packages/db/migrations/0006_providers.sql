-- =====================================================================
-- 0006 Providers (reference schema section 3).
-- Orgs are Moyasar merchants; agents do the work; assets carry capabilities.
-- =====================================================================

CREATE TYPE provider_entity AS ENUM ('freelancer', 'establishment', 'company');
CREATE TYPE merchant_status AS ENUM (
  'draft', 'submitted', 'pending', 'missing_docs',
  'semi_active', 'active', 'hold', 'rejected', 'disabled');

CREATE TABLE provider_orgs (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  entity_type         provider_entity NOT NULL,
  legal_name          text NOT NULL,
  display_name        text NOT NULL,
  registration_no     text,
  city_id             uuid REFERENCES cities(id),
  moyasar_merchant_id text,
  moyasar_status      merchant_status NOT NULL DEFAULT 'draft',
  nx_verify_ref       text,
  rating              numeric(3,2),
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, moyasar_merchant_id),
  UNIQUE (tenant_id, id)
);
CREATE INDEX provider_orgs_tenant_idx ON provider_orgs (tenant_id);

-- Provider owned extra questions reference their org (docs/05 layer 4).
ALTER TABLE attribute_definitions
  ADD CONSTRAINT attribute_definitions_owner_org_fk
  FOREIGN KEY (tenant_id, owner_org_id) REFERENCES provider_orgs (tenant_id, id);

CREATE TABLE provider_agents (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  org_id      uuid NOT NULL,
  full_name   text NOT NULL,
  mobile      text NOT NULL,
  role        text NOT NULL DEFAULT 'technician'
              CHECK (role IN ('owner', 'driver', 'technician', 'dispatcher')),
  rating      numeric(3,2),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mobile),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, org_id) REFERENCES provider_orgs (tenant_id, id)
);
CREATE INDEX provider_agents_tenant_idx ON provider_agents (tenant_id);

CREATE TABLE assets (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  org_id        uuid NOT NULL,
  vertical_id   uuid NOT NULL,
  asset_type    text NOT NULL,
  identifier    text,
  attributes    jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, org_id) REFERENCES provider_orgs (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id)
);
CREATE INDEX assets_tenant_idx ON assets (tenant_id);

CREATE TABLE agent_assets (
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  agent_id      uuid NOT NULL,
  asset_id      uuid NOT NULL,
  assigned_from timestamptz NOT NULL DEFAULT now(),
  assigned_to   timestamptz,
  PRIMARY KEY (agent_id, asset_id, assigned_from),
  FOREIGN KEY (tenant_id, agent_id) REFERENCES provider_agents (tenant_id, id),
  FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id)
);
CREATE INDEX agent_assets_tenant_idx ON agent_assets (tenant_id);

CREATE TABLE provider_groups (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  vertical_id uuid,
  name        jsonb NOT NULL,
  description jsonb,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id)
);
CREATE INDEX provider_groups_tenant_idx ON provider_groups (tenant_id);

CREATE TABLE provider_group_members (
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  group_id    uuid NOT NULL,
  org_id      uuid,
  agent_id    uuid,
  CHECK (org_id IS NOT NULL OR agent_id IS NOT NULL),
  FOREIGN KEY (tenant_id, group_id) REFERENCES provider_groups (tenant_id, id),
  FOREIGN KEY (tenant_id, org_id) REFERENCES provider_orgs (tenant_id, id),
  FOREIGN KEY (tenant_id, agent_id) REFERENCES provider_agents (tenant_id, id)
);
CREATE INDEX provider_group_members_tenant_idx ON provider_group_members (tenant_id);

CREATE TABLE provider_offerings (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  org_id        uuid NOT NULL,
  vertical_id   uuid NOT NULL,
  category_id   uuid,
  zone_id       uuid,
  capabilities  jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'applied'
                CHECK (status IN ('applied', 'under_review', 'needs_info',
                                  'approved', 'suspended', 'rejected')),
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  review_notes  text,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, org_id) REFERENCES provider_orgs (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id)
);
CREATE INDEX provider_offerings_tenant_idx ON provider_offerings (tenant_id);
CREATE INDEX provider_offerings_caps_gin ON provider_offerings USING gin (capabilities);

CREATE TABLE provider_documents (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  org_id          uuid NOT NULL,
  agent_id        uuid,
  asset_id        uuid,
  doc_type        text NOT NULL,
  file_url        text NOT NULL,
  expires_on      date,
  verify_status   text NOT NULL DEFAULT 'pending'
                  CHECK (verify_status IN ('pending', 'verified', 'rejected', 'expired')),
  nx_verify_ref   text,
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, org_id) REFERENCES provider_orgs (tenant_id, id),
  FOREIGN KEY (tenant_id, agent_id) REFERENCES provider_agents (tenant_id, id),
  FOREIGN KEY (tenant_id, asset_id) REFERENCES assets (tenant_id, id)
);
CREATE INDEX provider_documents_tenant_idx ON provider_documents (tenant_id);

CREATE TABLE provider_addons (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  offering_id   uuid NOT NULL,
  name          jsonb NOT NULL,
  price_type    text NOT NULL DEFAULT 'flat' CHECK (price_type IN ('flat', 'per_item', 'per_unit')),
  price_minor   bigint NOT NULL,
  currency      char(3) NOT NULL DEFAULT 'SAR',
  review_status field_owner_status NOT NULL DEFAULT 'pending_review',
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, offering_id) REFERENCES provider_offerings (tenant_id, id)
);
CREATE INDEX provider_addons_tenant_idx ON provider_addons (tenant_id);

CREATE TABLE agent_presence (
  agent_id    uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  status      text NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'online', 'busy')),
  location    geography(Point, 4326),
  heading     numeric,
  speed_kmh   numeric,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, agent_id) REFERENCES provider_agents (tenant_id, id)
);
CREATE INDEX agent_presence_tenant_idx ON agent_presence (tenant_id);
CREATE INDEX agent_presence_loc_gix ON agent_presence USING gist (location);

SELECT nx_enable_tenant_rls('provider_orgs');
SELECT nx_enable_tenant_rls('provider_agents');
SELECT nx_enable_tenant_rls('assets');
SELECT nx_enable_tenant_rls('agent_assets');
SELECT nx_enable_tenant_rls('provider_groups');
SELECT nx_enable_tenant_rls('provider_group_members');
SELECT nx_enable_tenant_rls('provider_offerings');
SELECT nx_enable_tenant_rls('provider_documents');
SELECT nx_enable_tenant_rls('provider_addons');
SELECT nx_enable_tenant_rls('agent_presence');
