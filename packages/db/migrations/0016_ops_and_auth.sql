-- =====================================================================
-- 0016 Operational tables (docs/04 rules 11 to 13) and authentication.
-- audit_logs, outbox_events, idempotency_keys, plus credential, OTP and
-- refresh token storage for the auth module. Card data is never stored here.
-- =====================================================================

-- Transactional outbox: written in the request transaction, drained by the
-- worker (which connects as the BYPASSRLS super admin role to fan out across
-- tenants). Still RLS protected so the app only writes its own tenant's events.
CREATE TABLE outbox_events (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  type          text NOT NULL,
  version       int NOT NULL DEFAULT 1,
  actor         jsonb NOT NULL DEFAULT '{"type":"system"}',
  payload       jsonb NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  attempts      int NOT NULL DEFAULT 0
);
CREATE INDEX outbox_events_tenant_idx ON outbox_events (tenant_id);
CREATE INDEX outbox_events_unpublished_idx ON outbox_events (created_at) WHERE published_at IS NULL;

-- Idempotency store for POST endpoints (24 h retention, docs/04 rule 13).
CREATE TABLE idempotency_keys (
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  key           text NOT NULL,
  request_hash  text NOT NULL,
  method        text NOT NULL,
  path          text NOT NULL,
  status_code   int,
  response      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);

-- Audit log for admin and money affecting actions, partitioned by month.
-- tenant_id NULL marks a platform (NX) action, visible only to the super admin.
CREATE TABLE audit_logs (
  id            uuid NOT NULL,
  tenant_id     uuid,
  actor_type    text NOT NULL,
  actor_id      uuid,
  action        text NOT NULL,
  entity        text NOT NULL,
  entity_id     text,
  before        jsonb,
  after         jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;
CREATE INDEX audit_logs_tenant_idx ON audit_logs (tenant_id, created_at);
CREATE INDEX audit_logs_entity_idx ON audit_logs (tenant_id, entity, entity_id);

-- Authentication. Staff use email + argon2id password + mandatory TOTP MFA for
-- admins; customers and agents use phone OTP. Refresh tokens rotate with reuse
-- detection. tenant_id NULL marks NX platform staff, managed by the super admin.
CREATE TABLE staff_credentials (
  staff_user_id uuid PRIMARY KEY REFERENCES staff_users(id),
  tenant_id     uuid,
  password_hash text NOT NULL,
  mfa_secret    text,
  mfa_enabled   boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_credentials_tenant_idx ON staff_credentials (tenant_id);

CREATE TABLE otp_challenges (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  subject_type  text NOT NULL CHECK (subject_type IN ('customer', 'agent')),
  mobile        text NOT NULL,
  code_hash     text NOT NULL,
  purpose       text NOT NULL DEFAULT 'login',
  attempts      int NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_challenges_tenant_idx ON otp_challenges (tenant_id);
CREATE INDEX otp_challenges_lookup ON otp_challenges (tenant_id, subject_type, mobile, created_at);

CREATE TABLE refresh_tokens (
  id            uuid PRIMARY KEY,
  tenant_id     uuid,
  subject_type  text NOT NULL CHECK (subject_type IN ('customer', 'agent', 'staff')),
  subject_id    uuid NOT NULL,
  token_hash    text NOT NULL UNIQUE,
  family_id     uuid NOT NULL,
  parent_id     uuid,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  used_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_tenant_idx ON refresh_tokens (tenant_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);

SELECT nx_enable_tenant_rls('outbox_events');
SELECT nx_enable_tenant_rls('idempotency_keys');
SELECT nx_enable_tenant_rls('audit_logs');
SELECT nx_enable_tenant_rls('otp_challenges');
-- staff_credentials and refresh_tokens include NX staff rows (tenant_id NULL),
-- managed by the super admin; the app only ever sees its own tenant rows.
SELECT nx_enable_tenant_rls('staff_credentials');
SELECT nx_enable_tenant_rls('refresh_tokens');
