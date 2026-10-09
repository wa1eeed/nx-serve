-- =====================================================================
-- 0015 Hierarchical settings with locks (reference schema section 13).
-- Resolution: platform > plan > tenant_group > tenant > provider, with locks
-- and min/max bounds set by upper levels. Upper level rows have tenant_id NULL
-- and are readable by all tenants; only the super admin may write them.
-- =====================================================================

CREATE TABLE setting_definitions (
  key              text PRIMARY KEY,
  category         text NOT NULL,
  data_type        text NOT NULL CHECK (data_type IN ('boolean', 'number', 'text', 'json', 'enum')),
  enum_values      text[],
  default_value    jsonb NOT NULL,
  editable_levels  text[] NOT NULL,
  requires_module  text,
  description      jsonb
);

CREATE TABLE setting_values (
  id               uuid PRIMARY KEY,
  key              text NOT NULL REFERENCES setting_definitions(key),
  level            text NOT NULL CHECK (level IN ('platform', 'plan', 'tenant_group', 'tenant', 'provider')),
  owner_id         uuid,
  tenant_id        uuid REFERENCES tenants(id),
  value            jsonb,
  min_value        numeric,
  max_value        numeric,
  is_locked        boolean NOT NULL DEFAULT false,
  updated_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, level, owner_id)
);
CREATE INDEX setting_values_tenant_idx ON setting_values (tenant_id);

-- setting_definitions is global reference data: no RLS.
SELECT nx_enable_tenant_or_global_rls('setting_values');
