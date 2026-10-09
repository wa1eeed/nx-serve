import { dbUrls } from '../env.js';
import { migrateReset, migrateUp } from '../migrate.js';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  const { owner } = dbUrls();

  let applied: string[];
  if (command === 'reset') {
    applied = await migrateReset(owner);
  } else if (command === 'up') {
    applied = await migrateUp(owner);
  } else {
    // eslint-disable-next-line no-console
    console.error(`Unknown command: ${command}. Use "up" or "reset".`);
    process.exit(1);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    applied.length > 0
      ? `Applied ${applied.length} migration(s): ${applied.join(', ')}`
      : 'No pending migrations.',
  );
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
