-- =====================================================================
-- 0004 Service catalog (reference schema section 2 and 9).
-- A vertical is configuration: categories, dynamic fields, item catalogs,
-- workflows and installable templates. Translatable text is jsonb {en, ar}.
-- =====================================================================

CREATE TYPE fulfillment_mode AS ENUM ('at_customer', 'point_to_point', 'at_provider', 'remote');
CREATE TYPE tracking_mode AS ENUM ('none', 'en_route', 'full_trip');
CREATE TYPE attr_scope AS ENUM ('order', 'provider_capability', 'asset');
CREATE TYPE attr_type AS ENUM (
  'text', 'number', 'boolean', 'single_select', 'multi_select',
  'date', 'location', 'media', 'item_list', 'reference');
CREATE TYPE field_owner_status AS ENUM ('draft', 'pending_review', 'approved', 'rejected');

-- Core engine order statuses (reference schema section 6). Declared here because
-- workflow_stages.maps_to references it; the orders table in 0009 reuses it.
CREATE TYPE order_status AS ENUM (
  'draft', 'quoting', 'awaiting_payment', 'dispatching', 'assigned', 'authorized',
  'en_route', 'arrived', 'in_progress', 'completed', 'captured',
  'cancelled', 'failed', 'disputed');

CREATE TABLE workflow_definitions (
  id           uuid PRIMARY KEY,
  tenant_id    uuid REFERENCES tenants(id),      -- NULL = NX global template
  name         jsonb NOT NULL,
  version      int NOT NULL DEFAULT 1,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflow_definitions_tenant_idx ON workflow_definitions (tenant_id);

CREATE TABLE verticals (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  code        text NOT NULL,
  name        jsonb NOT NULL,
  default_fulfillment fulfillment_mode NOT NULL DEFAULT 'at_customer',
  default_tracking    tracking_mode NOT NULL DEFAULT 'en_route',
  workflow_id uuid REFERENCES workflow_definitions(id),
  config      jsonb NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);
CREATE INDEX verticals_tenant_idx ON verticals (tenant_id);

CREATE TABLE categories (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  vertical_id uuid NOT NULL,
  parent_id   uuid,
  fulfillment fulfillment_mode,
  tracking    tracking_mode,
  workflow_id uuid REFERENCES workflow_definitions(id),
  code        text NOT NULL,
  name        jsonb NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, vertical_id, code),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id) REFERENCES categories (tenant_id, id)
);
CREATE INDEX categories_tenant_idx ON categories (tenant_id);

CREATE TABLE item_catalogs (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  vertical_id uuid NOT NULL,
  code        text NOT NULL,
  name        jsonb NOT NULL,
  UNIQUE (tenant_id, vertical_id, code),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id)
);
CREATE INDEX item_catalogs_tenant_idx ON item_catalogs (tenant_id);

CREATE TABLE catalog_items (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  catalog_id    uuid NOT NULL,
  code          text NOT NULL,
  name          jsonb NOT NULL,
  size_class    text,
  pricing_units numeric(8,2) NOT NULL DEFAULT 1,
  attributes    jsonb NOT NULL DEFAULT '{}',
  allow_custom  boolean NOT NULL DEFAULT false,
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, catalog_id, code),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, catalog_id) REFERENCES item_catalogs (tenant_id, id)
);
CREATE INDEX catalog_items_tenant_idx ON catalog_items (tenant_id);

CREATE TABLE attribute_definitions (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  vertical_id      uuid NOT NULL,
  category_id      uuid,
  scope            attr_scope NOT NULL,
  key              text NOT NULL,
  label            jsonb NOT NULL,
  data_type        attr_type NOT NULL,
  options          jsonb,
  validation       jsonb,
  is_required      boolean NOT NULL DEFAULT false,
  used_in_pricing  boolean NOT NULL DEFAULT false,
  used_in_matching boolean NOT NULL DEFAULT false,
  match_rule       jsonb,
  visibility_rule  jsonb,
  item_catalog_id  uuid,
  reference_source text,
  owner_org_id     uuid,            -- FK to provider_orgs added in 0006
  review_status    field_owner_status NOT NULL DEFAULT 'approved',
  sort_order       int NOT NULL DEFAULT 0,
  version          int NOT NULL DEFAULT 1,
  is_active        boolean NOT NULL DEFAULT true,
  -- Provider owned fields can never drive pricing or matching (docs/05).
  CHECK (owner_org_id IS NULL OR (used_in_pricing = false AND used_in_matching = false)),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id),
  FOREIGN KEY (tenant_id, item_catalog_id) REFERENCES item_catalogs (tenant_id, id)
);
CREATE UNIQUE INDEX attr_def_unique ON attribute_definitions (
  tenant_id,
  vertical_id,
  COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(owner_org_id, '00000000-0000-0000-0000-000000000000'::uuid),
  scope, key);
CREATE INDEX attribute_definitions_tenant_idx ON attribute_definitions (tenant_id);

CREATE TABLE category_requirements (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  category_id   uuid NOT NULL,
  doc_type      text NOT NULL,
  label         jsonb NOT NULL,
  applies_to    text NOT NULL DEFAULT 'org' CHECK (applies_to IN ('org', 'agent', 'asset')),
  is_required   boolean NOT NULL DEFAULT true,
  expires       boolean NOT NULL DEFAULT false,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id)
);
CREATE INDEX category_requirements_tenant_idx ON category_requirements (tenant_id);

CREATE TABLE workflow_stages (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid REFERENCES tenants(id),
  workflow_id        uuid NOT NULL REFERENCES workflow_definitions(id),
  code               text NOT NULL,
  label              jsonb NOT NULL,
  maps_to            order_status NOT NULL,
  sort_order         int NOT NULL,
  actor              text NOT NULL DEFAULT 'agent'
                     CHECK (actor IN ('agent', 'customer', 'system', 'ops')),
  tracking_active    boolean NOT NULL DEFAULT false,
  requires           jsonb NOT NULL DEFAULT '{}',
  payment_action     text NOT NULL DEFAULT 'none'
                     CHECK (payment_action IN ('none', 'authorize', 'capture', 'capture_partial',
                                               'capture_pct', 'deposit', 'supplement')),
  notify             jsonb NOT NULL DEFAULT '{}',
  sla_minutes        int,
  UNIQUE (workflow_id, code)
);
CREATE INDEX workflow_stages_tenant_idx ON workflow_stages (tenant_id);

-- NX global service templates (one click install), global reference data.
CREATE TABLE service_templates (
  id            uuid PRIMARY KEY,
  code          text NOT NULL UNIQUE,
  name          jsonb NOT NULL,
  description   jsonb,
  payload       jsonb NOT NULL,
  version       int NOT NULL DEFAULT 1,
  is_published  boolean NOT NULL DEFAULT false
);

CREATE TABLE tenant_template_installs (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  template_id   uuid NOT NULL REFERENCES service_templates(id),
  version       int NOT NULL,
  vertical_id   uuid,
  installed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id)
);
CREATE INDEX tenant_template_installs_tenant_idx ON tenant_template_installs (tenant_id);

SELECT nx_enable_tenant_or_global_rls('workflow_definitions');
SELECT nx_enable_tenant_or_global_rls('workflow_stages');
SELECT nx_enable_tenant_rls('verticals');
SELECT nx_enable_tenant_rls('categories');
SELECT nx_enable_tenant_rls('item_catalogs');
SELECT nx_enable_tenant_rls('catalog_items');
SELECT nx_enable_tenant_rls('attribute_definitions');
SELECT nx_enable_tenant_rls('category_requirements');
SELECT nx_enable_tenant_rls('tenant_template_installs');
-- service_templates is global reference data: no RLS.
