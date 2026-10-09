export const config = {
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  outbox: {
    batchSize: Number(process.env.OUTBOX_BATCH_SIZE ?? 100),
    intervalMs: Number(process.env.OUTBOX_INTERVAL_MS ?? 1000),
    maxAttempts: Number(process.env.OUTBOX_MAX_ATTEMPTS ?? 20),
  },
};
