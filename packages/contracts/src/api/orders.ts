import { z } from 'zod';

/**
 * Order contracts (docs/07). An order is created from a stored, unexpired estimate;
 * it carries a list of stops (docs/25 B1), dynamic attributes and add-ons. The
 * workflow engine drives the stage transitions. Money stays in minor-unit strings.
 * Card data never touches our servers: only a tokenized card reference is accepted.
 */

const MinorAmount = z.string().regex(/^-?\d+$/, 'minor amount is an integer serialised as a string');

export const OrderStatusSchema = z.enum([
  'draft',
  'quoting',
  'awaiting_payment',
  'dispatching',
  'assigned',
  'authorized',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'captured',
  'cancelled',
  'failed',
  'disputed',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const StopKindSchema = z.enum(['pickup', 'dropoff', 'service', 'waypoint']);

const ContactSchema = z.object({
  name: z.string().max(120).optional(),
  phone: z.string().max(20).optional(),
});

export const OrderStopInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  kind: StopKindSchema.default('waypoint'),
  address: z.record(z.unknown()).optional(),
  contact: ContactSchema.optional(),
  instructions: z.string().max(1000).optional(),
});

export const CreateOrderSchema = z.object({
  estimate_id: z.string().uuid(),
  stops: z.array(OrderStopInputSchema).min(1),
  attributes: z.record(z.unknown()).default({}),
  timing_type: z.enum(['now', 'scheduled', 'flexible_window']).default('now'),
  window_start: z.string().datetime().optional(),
  window_end: z.string().datetime().optional(),
  onsite_contact: ContactSchema.optional(),
  customer_notes: z.string().max(2000).optional(),
  /** A tokenized card reference (e.g. a Moyasar token). Card data never reaches us. */
  card_token_ref: z.string().max(200).optional(),
  terms_accepted: z.boolean(),
});
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

export const OrderStopDetailSchema = z.object({
  id: z.string().uuid(),
  sequence: z.number(),
  kind: z.string(),
  status: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  instructions: z.string().nullable(),
});

export const OrderDetailSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  status: OrderStatusSchema,
  current_stage_code: z.string().nullable(),
  vertical_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  tier_id: z.string().uuid().nullable(),
  city_id: z.string().uuid().nullable(),
  currency: z.string().length(3),
  estimated_amount_minor: MinorAmount.nullable(),
  authorized_minor: MinorAmount.nullable(),
  final_amount_minor: MinorAmount.nullable(),
  assigned_org_id: z.string().uuid().nullable(),
  assigned_agent_id: z.string().uuid().nullable(),
  timing_type: z.string(),
  created_at: z.string().datetime(),
  stops: z.array(OrderStopDetailSchema),
});
export type OrderDetail = z.infer<typeof OrderDetailSchema>;

/** Proof presented to leave the current stage. The API verifies the OTP code. */
export const StageProofSchema = z.object({
  photos: z.number().int().min(0).optional(),
  otp: z.string().max(12).optional(),
  signature: z.boolean().optional(),
  checklist: z.array(z.string()).optional(),
});

export const AdvanceStageSchema = z.object({
  proof: StageProofSchema.default({}),
});
export type AdvanceStageDto = z.infer<typeof AdvanceStageSchema>;

export const CancelOrderSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type CancelOrderDto = z.infer<typeof CancelOrderSchema>;

/** Manual assignment of a provider to an order (ops), which starts the workflow.
 * Automatic dispatch is a later increment; this is the manual dispatch mode. */
export const AssignOrderSchema = z.object({
  org_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  asset_id: z.string().uuid().optional(),
});
export type AssignOrderDto = z.infer<typeof AssignOrderSchema>;

/** Ops force transition (audited): advance to the next stage, or abort to a status. */
export const ForceTransitionSchema = z.object({
  to_status: z.enum(['cancelled', 'failed', 'disputed']).optional(),
  reason: z.string().min(1).max(1000),
});
export type ForceTransitionDto = z.infer<typeof ForceTransitionSchema>;

export const CancelResultSchema = z.object({
  order_id: z.string().uuid(),
  status: OrderStatusSchema,
  cancellation: z.object({
    action: z.enum(['none', 'void', 'partial_capture']),
    charge_minor: MinorAmount,
  }),
});
export type CancelResult = z.infer<typeof CancelResultSchema>;

/** The result of a stage transition: the new status, stage and the side effects. */
export const StageResultSchema = z.object({
  order_id: z.string().uuid(),
  status: OrderStatusSchema,
  current_stage_code: z.string().nullable(),
  payment_action: z.string(),
  tracking_active: z.boolean(),
});
export type StageResult = z.infer<typeof StageResultSchema>;
