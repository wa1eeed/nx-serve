import { describe, expect, it } from 'vitest';
import {
  EventEnvelopeSchema,
  MoneySchema,
  PaginationQuerySchema,
  ProblemSchema,
  TranslatableTextSchema,
  buildOpenApiDocument,
  buildProblem,
  httpStatusForCode,
  roomsForEvent,
} from './index.js';

describe('error codes and problem+json', () => {
  it('maps codes to HTTP status', () => {
    expect(httpStatusForCode('entitlement_required')).toBe(403);
    expect(httpStatusForCode('rate_limited')).toBe(429);
    expect(httpStatusForCode('validation_error')).toBe(422);
  });

  it('builds a valid problem body', () => {
    const problem = buildProblem('entitlement_required', {
      detail: 'The branded_apps module is required.',
      requestId: 'req_123',
      requiredPlan: 'advanced',
      requiredModule: 'branded_apps',
    });
    expect(() => ProblemSchema.parse(problem)).not.toThrow();
    expect(problem.status).toBe(403);
    expect(problem.type).toBe('https://errors.nxserve.dev/entitlement_required');
    expect(problem.required_module).toBe('branded_apps');
  });
});

describe('event envelope', () => {
  it('accepts a well formed envelope', () => {
    const envelope = {
      id: '018f8a1e-7a00-7000-8000-000000000000',
      type: 'order.stage_changed',
      tenant_id: '018f8a1e-7a00-7000-8000-000000000001',
      occurred_at: '2026-10-09T10:00:00.000Z',
      version: 1,
      actor: { type: 'system' as const },
      data: { order_id: 'x' },
    };
    expect(() => EventEnvelopeSchema.parse(envelope)).not.toThrow();
  });

  it('rejects a type that is not <aggregate>.<past_tense>', () => {
    const result = EventEnvelopeSchema.safeParse({
      id: '018f8a1e-7a00-7000-8000-000000000000',
      type: 'OrderCreated',
      tenant_id: '018f8a1e-7a00-7000-8000-000000000001',
      occurred_at: '2026-10-09T10:00:00.000Z',
      version: 1,
      actor: { type: 'system' },
      data: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('http conventions', () => {
  it('applies pagination defaults and bounds', () => {
    expect(PaginationQuerySchema.parse({}).limit).toBe(20);
    expect(PaginationQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(PaginationQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('requires en in translatable text and allows other locales', () => {
    expect(TranslatableTextSchema.safeParse({ en: 'Tow truck', ar: 'سطحة' }).success).toBe(true);
    expect(TranslatableTextSchema.safeParse({ ar: 'سطحة' }).success).toBe(false);
  });

  it('serialises money as an integer string plus currency', () => {
    expect(MoneySchema.safeParse({ amount_minor: '26400', currency: 'SAR' }).success).toBe(true);
    expect(MoneySchema.safeParse({ amount_minor: '264.00', currency: 'SAR' }).success).toBe(false);
  });
});

describe('OpenAPI document', () => {
  it('is a valid 3.1 document covering the Phase 0 surface', () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    const paths = Object.keys(doc.paths ?? {});
    expect(paths).toContain('/health');
    expect(paths).toContain('/app/bootstrap');
    expect(paths).toContain('/auth/otp/request');
    expect(paths).toContain('/auth/token/refresh');
    expect(doc.components?.schemas?.Problem).toBeDefined();
    expect(doc.components?.securitySchemes?.bearerAuth).toBeDefined();
  });
});

describe('template payload', () => {
  it('parses a minimal payload and applies defaults', async () => {
    const { TemplatePayloadSchema } = await import('./api/template.js');
    const parsed = TemplatePayloadSchema.parse({
      vertical: { code: 'towing', name: { en: 'Towing' }, default_fulfillment: 'point_to_point', default_tracking: 'full_trip' },
      workflow: { name: { en: 'wf' }, stages: [{ code: 'done', label: { en: 'Done' }, maps_to: 'completed', sort_order: 1 }] },
    });
    expect(parsed.categories).toEqual([]);
    expect(parsed.tiers).toEqual([]);
    expect(parsed.workflow.stages[0]?.payment_action).toBe('none');
  });

  it('rejects an invalid fulfillment mode', async () => {
    const { TemplatePayloadSchema } = await import('./api/template.js');
    const r = TemplatePayloadSchema.safeParse({
      vertical: { code: 'x', name: { en: 'x' }, default_fulfillment: 'flying', default_tracking: 'none' },
      workflow: { name: { en: 'w' }, stages: [] },
    });
    expect(r.success).toBe(false);
  });
});

describe('realtime room routing', () => {
  it('always targets tenant ops and adds entity rooms present in the event', () => {
    const rooms = roomsForEvent({
      id: '018f8a1e-7a00-7000-8000-000000000000',
      type: 'order.stage_changed',
      tenant_id: 'T',
      occurred_at: '2026-10-09T10:00:00.000Z',
      version: 1,
      actor: { type: 'system' },
      data: { order_id: 'O', agent_id: 'A' },
    });
    expect(rooms).toContain('tenant:T:ops');
    expect(rooms).toContain('order:O');
    expect(rooms).toContain('agent:A');
    expect(rooms).not.toContain('customer:undefined');
  });
});
