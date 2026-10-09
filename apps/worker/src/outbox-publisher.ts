import { type Redis } from 'ioredis';
import { type PgPool } from '@nxserve/db';
import { EVENTS_CHANNEL, type EventEnvelope, roomsForEvent } from '@nxserve/contracts';

export interface OutboxRow {
  id: string;
  tenant_id: string;
  type: string;
  version: number;
  actor: Record<string, unknown>;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

/** Converts a stored outbox row into the wire event envelope (ADR-0006). */
export function rowToEnvelope(row: OutboxRow): EventEnvelope {
  return {
    id: row.id,
    type: row.type,
    tenant_id: row.tenant_id,
    occurred_at: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at),
    version: row.version,
    actor: row.actor as EventEnvelope['actor'],
    data: row.payload,
  };
}

export interface OutboxPublisherOptions {
  batchSize: number;
  intervalMs: number;
  maxAttempts: number;
}

/**
 * Drains the transactional outbox and publishes each event to Redis for the
 * realtime gateway (and later webhooks and notifications). Uses FOR UPDATE SKIP
 * LOCKED so many workers can run, and the BYPASSRLS pool to read across tenants.
 * At least once: consumers are idempotent by event id.
 */
export class OutboxPublisher {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = false;

  constructor(
    private readonly pool: PgPool,
    private readonly redis: Redis,
    private readonly options: OutboxPublisherOptions,
    private readonly log: (message: string) => void = () => undefined,
  ) {}

  start(): void {
    this.scheduleNext(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    while (this.running) {
      await delay(50);
    }
  }

  private scheduleNext(ms: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.runTick(), ms);
  }

  private async runTick(): Promise<void> {
    if (this.running) {
      this.scheduleNext(this.options.intervalMs);
      return;
    }
    this.running = true;
    let published = 0;
    try {
      published = await this.tick();
    } catch (err) {
      this.log(`outbox tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
      // Drain quickly when there was work, otherwise back off to the interval.
      this.scheduleNext(published > 0 ? 0 : this.options.intervalMs);
    }
  }

  /** Publishes one batch; returns how many events were published. */
  async tick(): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query<OutboxRow>(
        `SELECT id, tenant_id, type, version, actor, payload, occurred_at
         FROM outbox_events
         WHERE published_at IS NULL AND attempts < $1
         ORDER BY created_at
         LIMIT $2
         FOR UPDATE SKIP LOCKED`,
        [this.options.maxAttempts, this.options.batchSize],
      );
      if (res.rows.length === 0) {
        await client.query('COMMIT');
        return 0;
      }

      const ids: string[] = [];
      for (const row of res.rows) {
        const envelope = rowToEnvelope(row);
        await this.redis.publish(
          EVENTS_CHANNEL,
          JSON.stringify({ envelope, rooms: roomsForEvent(envelope) }),
        );
        ids.push(row.id);
      }

      await client.query(
        `UPDATE outbox_events SET published_at = now(), attempts = attempts + 1 WHERE id = ANY($1::uuid[])`,
        [ids],
      );
      await client.query('COMMIT');
      return res.rows.length;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
