import { Redis } from 'ioredis';
import { createPool } from '@nxserve/db';
import { config } from './config.js';
import { OutboxPublisher } from './outbox-publisher.js';
import { createQueues, startWorkers } from './queues.js';

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: 'info', service: 'worker', message, time: Date.now() }));
}

async function main(): Promise<void> {
  // Cross tenant reads need the BYPASSRLS pool (the outbox spans all tenants).
  const pool = createPool('superadmin');
  const publishRedis = new Redis(config.redisUrl);
  const publisher = new OutboxPublisher(pool, publishRedis, config.outbox, log);
  publisher.start();

  const bullConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const queues = createQueues(bullConnection);
  const workers = startWorkers(bullConnection, log);

  log('worker started');

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`shutting down on ${signal}`);
    await publisher.stop();
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all(queues.map((q) => q.close()));
    publishRedis.disconnect();
    bullConnection.disconnect();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
