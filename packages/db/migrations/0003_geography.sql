-- =====================================================================
-- 0003 Geography (reference schema section 1 and 10a).
-- Cities and vehicle catalogs are global reference data maintained by NX.
-- Zones are tenant scoped (each tenant draws its own operating zones).
-- =====================================================================

CREATE TABLE cities (
  id          uuid PRIMARY KEY,
  country_code char(2) NOT NULL DEFAULT 'SA',
  name        jsonb NOT NULL,
  timezone    text NOT NULL DEFAULT 'Asia/Riyadh',
  boundary    geography(MultiPolygon, 4326),
  is_active   boolean NOT NULL DEFAULT true
);
CREATE INDEX cities_boundary_gix ON cities USING gist (boundary);

CREATE TABLE zones (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  city_id     uuid NOT NULL REFERENCES cities(id),
  name        jsonb NOT NULL,
  boundary    geography(MultiPolygon, 4326) NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX zones_tenant_idx ON zones (tenant_id);
CREATE INDEX zones_boundary_gix ON zones USING gist (boundary);

SELECT nx_enable_tenant_rls('zones');
-- cities is global reference data: no RLS.
