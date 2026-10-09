import { z } from 'zod';

/** Who or what caused an event. */
export const ActorSchema = z.object({
  type: z.enum(['customer', 'agent', 'staff', 'api_client', 'system']),
  id: z.string().uuid().optional(),
});
export type Actor = z.infer<typeof ActorSchema>;

/**
 * The transactional outbox event envelope (docs/03, ADR-0006). Written in the
 * same transaction as the state change; consumers are idempotent by `id`.
 * `type` is `<aggregate>.<past_tense>`, for example `order.stage_changed`.
 */
export const EventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  type: z.string().regex(/^[a-z_]+\.[a-z_]+$/, 'type must be <aggregate>.<past_tense>'),
  tenant_id: z.string().uuid(),
  occurred_at: z.string().datetime(),
  version: z.number().int().positive(),
  actor: ActorSchema,
  data: z.record(z.unknown()),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

/** Event type names known at Phase 0. Later phases add order and payment events. */
export const KNOWN_EVENT_TYPES = [
  'auth.staff_logged_in',
  'tenant.bootstrap_requested',
] as const;
export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];
