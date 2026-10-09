-- =====================================================================
-- 0005 Vehicle catalog (reference schema section 10b).
-- Makes, body types and models are global reference data maintained by NX.
-- Vehicle classes and the model to class mapping are per tenant.
-- =====================================================================

CREATE TABLE vehicle_makes (
  id          uuid PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        jsonb NOT NULL,
  logo_url    text,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE vehicle_body_types (
  id          uuid PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        jsonb NOT NULL
);

CREATE TABLE vehicle_models (
  id              uuid PRIMARY KEY,
  make_id         uuid NOT NULL REFERENCES vehicle_makes(id),
  code            text NOT NULL,
  name            jsonb NOT NULL,
  body_type_id    uuid NOT NULL REFERENCES vehicle_body_types(id),
  year_from       int,
  year_to         int,
  curb_weight_kg  int,
  drivetrain      text CHECK (drivetrain IN ('fwd', 'rwd', 'awd')),
  default_class   text,
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE (make_id, code, year_from)
);

CREATE TABLE vehicle_classes (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  code        text NOT NULL,
  name        jsonb NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);
CREATE INDEX vehicle_classes_tenant_idx ON vehicle_classes (tenant_id);

CREATE TABLE vehicle_class_map (
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  model_id      uuid NOT NULL REFERENCES vehicle_models(id),
  class_id      uuid NOT NULL,
  PRIMARY KEY (tenant_id, model_id),
  FOREIGN KEY (tenant_id, class_id) REFERENCES vehicle_classes (tenant_id, id)
);
CREATE INDEX vehicle_class_map_tenant_idx ON vehicle_class_map (tenant_id);

SELECT nx_enable_tenant_rls('vehicle_classes');
SELECT nx_enable_tenant_rls('vehicle_class_map');
-- vehicle_makes, vehicle_body_types, vehicle_models are global: no RLS.
