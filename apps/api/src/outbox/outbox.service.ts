import { Injectable } from '@nestjs/common';
import { type PoolClient } from '@nxserve/db';
import { uuidv7 } from '@nxserve/domain';
import { type Actor } from '../context/request-context.js';

export interface EmitInput {
  type: string;
  tenantId: string;
  data: Record<string, unknown>;
  actor: Actor;
  version?: number;
}

/**
 * Writes a domain event to the transactional outbox (ADR-0006). Always called
 * with the same client as the state change so the event commits atomically with
 * it; the worker drains and fans out. Never emit outside the transaction.
 */
@Injectable()
export class OutboxService {
  async emit(client: PoolClient, input: EmitInput): Promise<string> {
    const id = uuidv7();
    await client.query(
      `INSERT INTO outbox_events (id, tenant_id, type, version, actor, payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, now())`,
      [id, input.tenantId, input.type, input.version ?? 1, JSON.stringify(input.actor), JSON.stringify(input.data)],
    );
    return id;
  }
}
