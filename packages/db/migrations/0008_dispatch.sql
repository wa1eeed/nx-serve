-- =====================================================================
-- 0008 Dispatch engine (reference schema section 5).
-- Mode chosen per vertical, category, zone or group, with a fallback chain.
-- Kept pluggable so the later passenger transport pack fits (docs/25 section 6).
-- =====================================================================

CREATE TYPE dispatch_mode AS ENUM ('auto_nearest', 'broadcast', 'manual', 'customer_choice');

CREATE TABLE dispatch_policies (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  vertical_id         uuid NOT NULL,
  category_id         uuid,
  zone_id             uuid,
  group_id            uuid,
  mode                dispatch_mode NOT NULL,
  params              jsonb NOT NULL DEFAULT '{}',
  fallback_policy_id  uuid,
  priority            int NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, vertical_id) REFERENCES verticals (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories (tenant_id, id),
  FOREIGN KEY (tenant_id, zone_id) REFERENCES zones (tenant_id, id),
  FOREIGN KEY (tenant_id, group_id) REFERENCES provider_groups (tenant_id, id),
  FOREIGN KEY (tenant_id, fallback_policy_id) REFERENCES dispatch_policies (tenant_id, id)
);
CREATE INDEX dispatch_policies_tenant_idx ON dispatch_policies (tenant_id);

SELECT nx_enable_tenant_rls('dispatch_policies');
