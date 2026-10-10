-- Idempotent group membership: one row per (tenant, group, org or agent).
-- provider_group_members has no primary key, so without this a check-then-insert
-- could race and create duplicate memberships. The COALESCE sentinels let the
-- unique index cover the nullable org_id / agent_id columns.

CREATE UNIQUE INDEX provider_group_members_uniq
  ON provider_group_members (
    tenant_id,
    group_id,
    COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
