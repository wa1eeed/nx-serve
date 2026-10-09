import pg from 'pg';
import { dbUrls } from './env.js';

const { Pool } = pg;
export type { Pool as PgPool } from 'pg';
export type PoolClient = pg.PoolClient;

export type DbRole = 'app' | 'superadmin' | 'owner';

/**
 * Ensure bigint (int8) comes back as a string, not a JS number, so money in
 * minor units never loses precision. The domain layer parses it into bigint.
 */
pg.types.setTypeParser(20, (value) => value);

/** Creates a connection pool for a given role. The API uses the `app` role. */
export function createPool(role: DbRole = 'app'): pg.Pool {
  const urls = dbUrls();
  const connectionString = urls[role];
  return new Pool({ connectionString, max: 10 });
}

/**
 * Runs `fn` inside a transaction with `app.tenant_id` set for the duration via
 * SET LOCAL, so Row Level Security scopes every statement to this tenant. This
 * is the only supported way for the app role to touch tenant data.
 */
export async function withTenant<T>(
  pool: pg.Pool,
  tenantId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config with is_local = true is the parameterised form of SET LOCAL.
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
