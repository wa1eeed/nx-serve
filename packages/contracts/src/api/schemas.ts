import { z } from 'zod';
import { MoneySchema, TranslatableTextSchema } from '../http.js';

/**
 * Request and response schemas for the public API, the single source for both
 * the NestJS validation pipes and the generated OpenAPI document (contract
 * first, ADR-0008). Phase 0 covers health, bootstrap, me and auth.
 */

export const HealthResponseSchema = z.object({ status: z.literal('ok') });

export const ReadyResponseSchema = z.object({
  status: z.literal('ok'),
  checks: z.record(z.literal('ok')),
});

export const BootstrapResponseSchema = z.object({
  tenant: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    display_name: z.string(),
    branding: z.record(z.unknown()),
  }),
  locale: z.enum(['ar', 'en']),
  default_locale: z.string(),
  supported_locales: z.array(z.string()),
  payments_enabled: z.boolean(),
  feature_flags: z.record(z.unknown()),
});

export const MeResponseSchema = z.object({
  request_id: z.string(),
  locale: z.enum(['ar', 'en']),
  actor: z.object({ type: z.string(), id: z.string().uuid().optional() }),
  tenant_id: z.string().uuid().nullable(),
});

// --- Auth ---
export const OtpRequestSchema = z.object({
  mobile: z.string().min(8).max(20),
  subject_type: z.enum(['customer', 'agent']),
});
export type OtpRequestDto = z.infer<typeof OtpRequestSchema>;

export const OtpChallengeResponseSchema = z.object({ challenge_id: z.string().uuid() });

export const OtpVerifySchema = z.object({
  challenge_id: z.string().uuid(),
  code: z.string().min(4).max(8),
});
export type OtpVerifyDto = z.infer<typeof OtpVerifySchema>;

export const StaffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});
export type StaffLoginDto = z.infer<typeof StaffLoginSchema>;

export const MfaVerifySchema = z.object({
  mfa_token: z.string(),
  code: z.string().length(6),
});
export type MfaVerifyDto = z.infer<typeof MfaVerifySchema>;

export const RefreshSchema = z.object({ refresh_token: z.string() });
export type RefreshDto = z.infer<typeof RefreshSchema>;

export const TokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int(),
});

export const MfaRequiredSchema = z.object({
  mfa_required: z.literal(true),
  mfa_token: z.string(),
});

export const StaffLoginResponseSchema = z.union([TokenPairSchema, MfaRequiredSchema]);

// --- Catalog ---
export const VerticalSummarySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: TranslatableTextSchema,
  default_fulfillment: z.enum(['at_customer', 'point_to_point', 'at_provider', 'remote']),
  default_tracking: z.enum(['none', 'en_route', 'full_trip']),
  is_active: z.boolean(),
});

export const RenderedFieldSchema = z.object({
  key: z.string(),
  type: z.string(),
  required: z.boolean(),
  label: z.string().optional(),
  i18n_key: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  validation: z.record(z.unknown()).optional(),
  visibility: z.record(z.unknown()).optional(),
  allow_custom: z.boolean().optional(),
  reference_source: z.string().optional(),
});

export const FormSchemaSchema = z.object({
  version: z.string(),
  locale: z.enum(['ar', 'en']),
  fulfillment: z.enum(['at_customer', 'point_to_point', 'at_provider', 'remote']),
  tracking: z.enum(['none', 'en_route', 'full_trip']),
  sections: z.array(
    z.object({ key: z.enum(['fulfillment', 'service']), fields: z.array(RenderedFieldSchema) }),
  ),
});

// --- Catalog admin: fields (attribute definitions) ---
const FieldTypeEnum = z.enum([
  'text', 'number', 'boolean', 'single_select', 'multi_select',
  'date', 'location', 'media', 'item_list', 'reference',
]);

export const CreateFieldSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/, 'key must be snake_case'),
  category_id: z.string().uuid().optional(),
  scope: z.enum(['order', 'provider_capability', 'asset']).default('order'),
  data_type: FieldTypeEnum,
  label: TranslatableTextSchema,
  required: z.boolean().default(false),
  options: z.array(z.object({ value: z.string(), label: TranslatableTextSchema })).optional(),
  validation: z.record(z.unknown()).optional(),
  visibility_rule: z.record(z.unknown()).optional(),
  reference_source: z.string().optional(),
  item_catalog_id: z.string().uuid().optional(),
  used_in_pricing: z.boolean().default(false),
  used_in_matching: z.boolean().default(false),
  match_rule: z.record(z.unknown()).optional(),
  sort_order: z.number().int().default(0),
});
export type CreateFieldDto = z.infer<typeof CreateFieldSchema>;

export const UpdateFieldSchema = CreateFieldSchema.partial().omit({ scope: true });
export type UpdateFieldDto = z.infer<typeof UpdateFieldSchema>;

export const FieldResponseSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  data_type: z.string(),
  label: TranslatableTextSchema,
  required: z.boolean(),
  version: z.number().int(),
});

/** Full field definition for the management console edit form (raw, not localized). */
export const FieldDetailSchema = z.object({
  id: z.string().uuid(),
  vertical_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  scope: z.enum(['order', 'provider_capability', 'asset']),
  key: z.string(),
  data_type: FieldTypeEnum,
  label: TranslatableTextSchema,
  required: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: TranslatableTextSchema })).nullable(),
  validation: z.record(z.unknown()).nullable(),
  visibility_rule: z.record(z.unknown()).nullable(),
  reference_source: z.string().nullable(),
  item_catalog_id: z.string().uuid().nullable(),
  used_in_pricing: z.boolean(),
  used_in_matching: z.boolean(),
  match_rule: z.record(z.unknown()).nullable(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  version: z.number().int(),
});
export type FieldDetail = z.infer<typeof FieldDetailSchema>;

export const OkStatusSchema = z.object({ status: z.literal('ok') });

// --- Settings ---
export const UpsertSettingSchema = z.object({ value: z.unknown() });
export type UpsertSettingDto = z.infer<typeof UpsertSettingSchema>;

// --- Catalog admin: verticals and categories ---
const FulfillmentEnum = z.enum(['at_customer', 'point_to_point', 'at_provider', 'remote']);
const TrackingEnum = z.enum(['none', 'en_route', 'full_trip']);

export const CreateVerticalSchema = z.object({
  code: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
  name: TranslatableTextSchema,
  default_fulfillment: FulfillmentEnum,
  default_tracking: TrackingEnum,
  config: z.record(z.unknown()).optional(),
});
export type CreateVerticalDto = z.infer<typeof CreateVerticalSchema>;
export const UpdateVerticalSchema = CreateVerticalSchema.partial().omit({ code: true });
export type UpdateVerticalDto = z.infer<typeof UpdateVerticalSchema>;

/** Full vertical for the management console edit form (raw, not localized). */
export const VerticalDetailSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: TranslatableTextSchema,
  default_fulfillment: FulfillmentEnum,
  default_tracking: TrackingEnum,
  config: z.record(z.unknown()),
  is_active: z.boolean(),
});
export type VerticalDetail = z.infer<typeof VerticalDetailSchema>;

export const CreateCategorySchema = z.object({
  code: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
  name: TranslatableTextSchema,
  parent_id: z.string().uuid().optional(),
  fulfillment: FulfillmentEnum.optional(),
  tracking: TrackingEnum.optional(),
  sort_order: z.number().int().default(0),
});
export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
export const UpdateCategorySchema = CreateCategorySchema.partial().omit({ code: true });
export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;

/** Full category for the management console edit form (raw, not localized). */
export const CategoryDetailSchema = z.object({
  id: z.string().uuid(),
  vertical_id: z.string().uuid(),
  code: z.string(),
  name: TranslatableTextSchema,
  parent_id: z.string().uuid().nullable(),
  fulfillment: FulfillmentEnum.nullable(),
  tracking: TrackingEnum.nullable(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});
export type CategoryDetail = z.infer<typeof CategoryDetailSchema>;

// --- Catalog admin: workflow and stages (docs/07, docs/25 stops and payment plans) ---
export const OrderStatusEnum = z.enum([
  'draft', 'quoting', 'awaiting_payment', 'dispatching', 'assigned', 'authorized',
  'en_route', 'arrived', 'in_progress', 'completed', 'captured',
  'cancelled', 'failed', 'disputed',
]);
export const StageActorEnum = z.enum(['agent', 'customer', 'system', 'ops']);
export const PaymentActionEnum = z.enum([
  'none', 'authorize', 'capture', 'capture_partial', 'capture_pct', 'deposit', 'supplement',
]);

export const CreateStageSchema = z.object({
  code: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/, 'code must be snake_case'),
  label: TranslatableTextSchema,
  maps_to: OrderStatusEnum,
  sort_order: z.number().int().default(0),
  actor: StageActorEnum.default('agent'),
  tracking_active: z.boolean().default(false),
  requires: z.record(z.unknown()).default({}),
  payment_action: PaymentActionEnum.default('none'),
  notify: z.record(z.unknown()).default({}),
  sla_minutes: z.number().int().positive().nullable().optional(),
});
export type CreateStageDto = z.infer<typeof CreateStageSchema>;
export const UpdateStageSchema = CreateStageSchema.partial().omit({ code: true });
export type UpdateStageDto = z.infer<typeof UpdateStageSchema>;

export const StageDetailSchema = z.object({
  id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  code: z.string(),
  label: TranslatableTextSchema,
  maps_to: OrderStatusEnum,
  sort_order: z.number().int(),
  actor: StageActorEnum,
  tracking_active: z.boolean(),
  requires: z.record(z.unknown()),
  payment_action: PaymentActionEnum,
  notify: z.record(z.unknown()),
  sla_minutes: z.number().int().nullable(),
});
export type StageDetail = z.infer<typeof StageDetailSchema>;

export const CreateWorkflowSchema = z.object({ name: TranslatableTextSchema });
export type CreateWorkflowDto = z.infer<typeof CreateWorkflowSchema>;
export const UpdateWorkflowSchema = z.object({ name: TranslatableTextSchema });
export type UpdateWorkflowDto = z.infer<typeof UpdateWorkflowSchema>;

export const WorkflowDetailSchema = z.object({
  id: z.string().uuid(),
  name: TranslatableTextSchema,
  version: z.number().int(),
  is_active: z.boolean(),
  stages: z.array(StageDetailSchema),
});
export type WorkflowDetail = z.infer<typeof WorkflowDetailSchema>;

export const ReorderSchema = z.object({ order: z.array(z.string().uuid()).min(1) });
export type ReorderDto = z.infer<typeof ReorderSchema>;

// Re-export shared building blocks so the OpenAPI registry can reference them.
export { MoneySchema, TranslatableTextSchema };
