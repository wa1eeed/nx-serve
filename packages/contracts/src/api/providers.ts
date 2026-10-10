import { z } from 'zod';
import { TranslatableTextSchema } from '../http.js';

/**
 * Provider onboarding and administration contracts (docs/08). Single source for
 * the NestJS validation pipes and the generated OpenAPI. Mirrors the provider
 * schema enums (migrations 0006, 0008). Money stays out of these; provider
 * payouts flow through payment splits (docs/06).
 */

export const ProviderEntitySchema = z.enum(['freelancer', 'establishment', 'company']);
export const MerchantStatusSchema = z.enum([
  'draft', 'submitted', 'pending', 'missing_docs', 'semi_active', 'active', 'hold', 'rejected', 'disabled',
]);
export const AgentRoleSchema = z.enum(['owner', 'driver', 'technician', 'dispatcher']);
export const OfferingStatusSchema = z.enum(['applied', 'under_review', 'needs_info', 'approved', 'suspended', 'rejected']);
export const DocVerifyStatusSchema = z.enum(['pending', 'verified', 'rejected', 'expired']);
export const DocScopeSchema = z.enum(['org', 'agent', 'asset']);
export const PresenceStatusSchema = z.enum(['offline', 'online', 'busy']);

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'date is not a valid calendar date');
const MobileSchema = z.string().trim().min(8).max(20);
// A light IBAN check: country code then alphanumerics. Full validation is the gateway's.
const IbanSchema = z.string().trim().min(15).max(34).regex(/^[A-Z]{2}[0-9A-Z]+$/, 'iban');

// --- Self service (provider owner, actor type agent) ---

export const RegisterProviderSchema = z.object({
  entity_type: ProviderEntitySchema,
  legal_name: z.string().min(1).max(200),
  display_name: z.string().min(1).max(200),
  registration_no: z.string().max(60).optional(),
  city_id: z.string().uuid().optional(),
  iban: IbanSchema,
  national_id: z.string().trim().min(8).max(20).optional(),
  owner: z.object({ full_name: z.string().min(1).max(160), mobile: MobileSchema }),
});
export type RegisterProviderDto = z.infer<typeof RegisterProviderSchema>;

/** Registration is authenticated by a verified phone OTP (no pre-existing agent). */
export const RegisterProviderRequestSchema = RegisterProviderSchema.extend({
  challenge_id: z.string().uuid(),
  code: z.string().min(4).max(8),
});
export type RegisterProviderRequestDto = z.infer<typeof RegisterProviderRequestSchema>;

export const CreateAgentSchema = z.object({
  full_name: z.string().min(1).max(160),
  mobile: MobileSchema,
  role: AgentRoleSchema.default('technician'),
});
export type CreateAgentDto = z.infer<typeof CreateAgentSchema>;

export const CreateAssetSchema = z.object({
  vertical_id: z.string().uuid(),
  asset_type: z.string().min(1).max(64),
  identifier: z.string().max(64).optional(),
  attributes: z.record(z.unknown()).default({}),
});
export type CreateAssetDto = z.infer<typeof CreateAssetSchema>;

export const LinkAgentAssetSchema = z.object({ agent_id: z.string().uuid(), asset_id: z.string().uuid() });
export type LinkAgentAssetDto = z.infer<typeof LinkAgentAssetSchema>;

export const ApplyOfferingSchema = z.object({
  vertical_id: z.string().uuid(),
  category_id: z.string().uuid().optional(),
  zone_id: z.string().uuid().optional(),
  capabilities: z.record(z.unknown()).default({}),
});
export type ApplyOfferingDto = z.infer<typeof ApplyOfferingSchema>;

export const UploadDocumentSchema = z
  .object({
    doc_type: z.string().min(1).max(64),
    applies_to: DocScopeSchema.default('org'),
    file_url: z.string().url(),
    expires_on: DateSchema.optional(),
    agent_id: z.string().uuid().optional(),
    asset_id: z.string().uuid().optional(),
  })
  // The document scope must agree with its target: the subject FK that carries
  // the scope must be present, and the other must be absent (provider_documents
  // has no applies_to column, so the populated FK implies the scope).
  .superRefine((v, ctx) => {
    if (v.applies_to === 'agent' && !v.agent_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['agent_id'], message: 'agent_id is required when applies_to is agent' });
    }
    if (v.applies_to === 'asset' && !v.asset_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['asset_id'], message: 'asset_id is required when applies_to is asset' });
    }
    if (v.applies_to !== 'agent' && v.agent_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['agent_id'], message: 'agent_id is only allowed when applies_to is agent' });
    }
    if (v.applies_to !== 'asset' && v.asset_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['asset_id'], message: 'asset_id is only allowed when applies_to is asset' });
    }
  });
export type UploadDocumentDto = z.infer<typeof UploadDocumentSchema>;

export const PresenceSchema = z.object({
  status: PresenceStatusSchema,
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  heading: z.number().min(0).max(360).optional(),
  speed_kmh: z.number().min(0).optional(),
});
export type PresenceDto = z.infer<typeof PresenceSchema>;

// --- Tenant admin (actor type staff, providers.approve) ---

export const ReviewOfferingSchema = z.object({
  decision: z.enum(['approve', 'needs_info', 'reject']),
  notes: z.string().max(1000).optional(),
  probation: z.boolean().optional(),
});
export type ReviewOfferingDto = z.infer<typeof ReviewOfferingSchema>;

export const ReviewDocumentSchema = z.object({
  decision: z.enum(['verify', 'reject']),
  notes: z.string().max(1000).optional(),
});
export type ReviewDocumentDto = z.infer<typeof ReviewDocumentSchema>;

export const CreateProviderGroupSchema = z.object({
  vertical_id: z.string().uuid().optional(),
  name: TranslatableTextSchema,
  description: TranslatableTextSchema.optional(),
});
export type CreateProviderGroupDto = z.infer<typeof CreateProviderGroupSchema>;

/** Merchant status update from the gateway webhook (minimal until Q9 confirmed). */
export const MerchantWebhookSchema = z.object({
  merchant_id: z.string().min(1),
  status: MerchantStatusSchema,
});
export type MerchantWebhookDto = z.infer<typeof MerchantWebhookSchema>;

// --- Responses ---

export const ProviderOrgDetailSchema = z.object({
  id: z.string().uuid(),
  entity_type: ProviderEntitySchema,
  legal_name: z.string(),
  display_name: z.string(),
  registration_no: z.string().nullable(),
  city_id: z.string().uuid().nullable(),
  moyasar_merchant_id: z.string().nullable(),
  moyasar_status: MerchantStatusSchema,
  nx_verify_ref: z.string().nullable(),
  rating: z.number().nullable(),
  is_active: z.boolean(),
});
export type ProviderOrgDetail = z.infer<typeof ProviderOrgDetailSchema>;

export const AgentDetailSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  full_name: z.string(),
  mobile: z.string(),
  role: AgentRoleSchema,
  rating: z.number().nullable(),
  is_active: z.boolean(),
});
export type AgentDetail = z.infer<typeof AgentDetailSchema>;

export const AssetDetailSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  vertical_id: z.string().uuid(),
  asset_type: z.string(),
  identifier: z.string().nullable(),
  attributes: z.record(z.unknown()),
  is_active: z.boolean(),
});
export type AssetDetail = z.infer<typeof AssetDetailSchema>;

export const OfferingDetailSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  vertical_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  zone_id: z.string().uuid().nullable(),
  capabilities: z.record(z.unknown()),
  status: OfferingStatusSchema,
  review_notes: z.string().nullable(),
  is_active: z.boolean(),
});
export type OfferingDetail = z.infer<typeof OfferingDetailSchema>;

export const DocumentDetailSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  agent_id: z.string().uuid().nullable(),
  asset_id: z.string().uuid().nullable(),
  doc_type: z.string(),
  file_url: z.string(),
  expires_on: z.string().nullable(),
  verify_status: DocVerifyStatusSchema,
});
export type DocumentDetail = z.infer<typeof DocumentDetailSchema>;

export const ProviderGroupDetailSchema = z.object({
  id: z.string().uuid(),
  vertical_id: z.string().uuid().nullable(),
  name: TranslatableTextSchema,
  description: TranslatableTextSchema.nullable(),
});
export type ProviderGroupDetail = z.infer<typeof ProviderGroupDetailSchema>;

/** Onboarding readiness (docs/08 section 2), computed by the domain resolver. */
export const OnboardingStatusSchema = z.object({
  state: z.enum([
    'draft', 'verifying', 'documents_pending', 'under_review', 'needs_info', 'active', 'suspended', 'rejected',
  ]),
  steps: z.object({
    identity: z.string(),
    merchant: z.string(),
    documents: z.string(),
    approval: z.string(),
  }),
  eligible_for_dispatch: z.boolean(),
  blockers: z.array(z.string()),
  documents: z.object({
    all_required_satisfied: z.boolean(),
    blocking_required: z.array(z.string()),
    pending_required: z.array(z.string()),
    expiring: z.array(z.string()),
    items: z.array(
      z.object({
        doc_type: z.string(),
        applies_to: DocScopeSchema,
        required: z.boolean(),
        state: z.enum(['satisfied', 'pending', 'rejected', 'expired', 'missing']),
        expiring_soon: z.boolean(),
      }),
    ),
  }),
});
export type OnboardingStatus = z.infer<typeof OnboardingStatusSchema>;
