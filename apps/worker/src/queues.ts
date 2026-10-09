import { Queue, Worker, type ConnectionOptions } from 'bullmq';

/** BullMQ queues. Phase 0 wires the pipeline; real jobs arrive in later phases. */
export const QUEUE_NAMES = {
  webhooks: 'webhooks',
  notifications: 'notifications',
  maintenance: 'maintenance',
} as const;

export function createQueues(connection: ConnectionOptions): Queue[] {
  return Object.values(QUEUE_NAMES).map((name) => new Queue(name, { connection }));
}

/**
 * Starts a worker per queue. These are skeletons that log and succeed; the
 * dispatch rounds, auth expiry guard, webhook delivery, notifications, billing
 * and reconciliation jobs are implemented in their phases (docs/15).
 */
export function startWorkers(
  connection: ConnectionOptions,
  log: (message: string) => void,
): Worker[] {
  return Object.values(QUEUE_NAMES).map(
    (name) =>
      new Worker(
        name,
        (job) => {
          log(`[${name}] processed job ${job.id ?? 'unknown'}`);
          return Promise.resolve();
        },
        { connection },
      ),
  );
}
