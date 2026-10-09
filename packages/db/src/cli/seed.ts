import pg from 'pg';
import { dbUrls } from '../env.js';
import { runSeed } from '../seed.js';

const { Client } = pg;

async function main(): Promise<void> {
  // Seeds run as the super admin role (BYPASSRLS) to write reference data.
  const client = new Client({ connectionString: dbUrls().superadmin });
  await client.connect();
  try {
    await runSeed(client);
    // eslint-disable-next-line no-console
    console.log('Seed complete: nx and demo tenants, towing template, provider and customer.');
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
