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

// Re-export shared building blocks so the OpenAPI registry can reference them.
export { MoneySchema, TranslatableTextSchema };
