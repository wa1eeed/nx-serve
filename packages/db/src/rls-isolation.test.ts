import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { uuidv7 } from '@nxserve/domain';
import { migrateUp } from './migrate.js';

const { Client } = pg;

let container: StartedPostgreSqlContainer;
let ownerUri: string;
let appUri: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
    .withUsername('nxserve_owner')
    .withPassword('nxserve_owner')
    .withDatabase('nxserve')
    .start();
  ownerUri = container.getConnectionUri();
  appUri = `postgres://nxserve_app:nxserve_app@${container.getHost()}:${container.getMappedPort(5432)}/nxserve`;
  await migrateUp(ownerUri);
});

afterAll(async () => {
  await container?.stop();
});

/** Every table carrying tenant_id must have FORCE RLS and a policy with both USING and WITH CHECK. */
async function tenantTables(client: pg.Client): Promise<
  { relname: string; rls: boolean; force: boolean }[]
> {
  const res = await client.query<{ relname: string; rls: boolean; force: boolean }>(`
    SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS force
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = 'public'
          AND col.table_name = c.relname
          AND col.column_name = 'tenant_id')
    ORDER BY c.relname
  `);
  return res.rows;
}

describe('row level security isolation', () => {
  it('forces RLS with USING and WITH CHECK on every tenant table (exhaustive)', async () => {
    const owner = new Client({ connectionString: ownerUri });
    await owner.connect();
    try {
      const tables = await tenantTables(owner);
      // Sanity: the conversion produced a large tenant surface.
      expect(tables.length).toBeGreaterThan(50);

      const policies = await owner.query<{
        tablename: string;
        qual: string | null;
        with_check: string | null;
      }>(`SELECT tablename, qual, with_check FROM pg_policies WHERE schemaname = 'public'`);

      const failures: string[] = [];
      for (const t of tables) {
        if (!t.rls) failures.push(`${t.relname}: RLS not enabled`);
        if (!t.force) failures.push(`${t.relname}: RLS not forced`);
        const forTable = policies.rows.filter((p) => p.tablename === t.relname);
        if (forTable.length === 0) {
          failures.push(`${t.relname}: no policy`);
          continue;
        }
        if (!forTable.some((p) => p.qual !== null)) failures.push(`${t.relname}: policy has no USING`);
        if (!forTable.some((p) => p.with_check !== null)) {
          failures.push(`${t.relname}: policy has no WITH CHECK`);
        }
      }
      expect(failures).toEqual([]);
    } finally {
      await owner.end();
    }
  });

  it('prevents cross tenant reads, writes and updates for the app role', async () => {
    const owner = new Client({ connectionString: ownerUri });
    await owner.connect();
    const tenantA = uuidv7();
    const tenantB = uuidv7();
    const customerA = uuidv7();
    const customerB = uuidv7();
    try {
      // Seed as the owner (superuser in the container), which bypasses RLS.
      for (const [id, slug] of [
        [tenantA, 'tenant-a'],
        [tenantB, 'tenant-b'],
      ]) {
        await owner.query(
          `INSERT INTO tenants (id, slug, legal_name, display_name) VALUES ($1, $2, $3, $3)`,
          [id, slug, slug],
        );
      }
      await owner.query(
        `INSERT INTO customers (id, tenant_id, mobile) VALUES ($1, $2, '+966500000001')`,
        [customerA, tenantA],
      );
      await owner.query(
        `INSERT INTO customers (id, tenant_id, mobile) VALUES ($1, $2, '+966500000002')`,
        [customerB, tenantB],
      );
    } finally {
      await owner.end();
    }

    const app = new Client({ connectionString: appUri });
    await app.connect();
    try {
      // Tenant A sees only its own customer.
      await app.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
      const asA = await app.query('SELECT id FROM customers');
      expect(asA.rows.map((r: { id: string }) => r.id)).toEqual([customerA]);

      // Tenant A sees only its own tenant row.
      const tenantsAsA = await app.query('SELECT id FROM tenants');
      expect(tenantsAsA.rows.map((r: { id: string }) => r.id)).toEqual([tenantA]);

      // Tenant B sees only its own customer.
      await app.query("SELECT set_config('app.tenant_id', $1, false)", [tenantB]);
      const asB = await app.query('SELECT id FROM customers');
      expect(asB.rows.map((r: { id: string }) => r.id)).toEqual([customerB]);

      // From tenant A, inserting a row for tenant B is rejected by WITH CHECK.
      await app.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
      await expect(
        app.query(`INSERT INTO customers (id, tenant_id, mobile) VALUES ($1, $2, '+966500000003')`, [
          uuidv7(),
          tenantB,
        ]),
      ).rejects.toThrow();

      // From tenant A, updating tenant B's customer affects zero rows (invisible).
      const upd = await app.query(
        `UPDATE customers SET full_name = 'x' WHERE tenant_id = $1`,
        [tenantB],
      );
      expect(upd.rowCount).toBe(0);

      // With no tenant set, RLS denies everything.
      await app.query("SELECT set_config('app.tenant_id', '', false)");
      const none = await app.query('SELECT id FROM customers');
      expect(none.rowCount).toBe(0);
    } finally {
      await app.end();
    }
  });
});
