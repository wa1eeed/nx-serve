import { describe, expect, it } from 'vitest';
import { EventEnvelopeSchema } from '@nxserve/contracts';
import { rowToEnvelope } from './outbox-publisher.js';

describe('rowToEnvelope', () => {
  it('maps an outbox row to a valid event envelope', () => {
    const envelope = rowToEnvelope({
      id: '018f8a1e-7a00-7000-8000-000000000000',
      tenant_id: '018f8a1e-7a00-7000-8000-000000000001',
      type: 'order.created',
      version: 1,
      actor: { type: 'system' },
      payload: { order_id: 'O1' },
      occurred_at: new Date('2026-10-09T10:00:00.000Z'),
    });

    expect(envelope.occurred_at).toBe('2026-10-09T10:00:00.000Z');
    expect(envelope.data).toEqual({ order_id: 'O1' });
    expect(() => EventEnvelopeSchema.parse(envelope)).not.toThrow();
  });
});
