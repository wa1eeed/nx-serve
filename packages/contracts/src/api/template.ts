import { z } from 'zod';
import { TranslatableTextSchema } from '../http.js';

/**
 * Service template payload (docs/10 section 9): a complete vertical a tenant
 * installs in one click, then edits. This is the single source for the stored
 * template JSON, the seed blueprint and the installer. Phase 1 covers the
 * catalog, workflow, tiers and requirements; pricing, fees and dispatch are
 * layered in their phases.
 */

const Fulfillment = z.enum(['at_customer', 'point_to_point', 'at_provider', 'remote']);
const Tracking = z.enum(['none', 'en_route', 'full_trip']);
const FieldType = z.enum([
  'text',
  'number',
  'boolean',
  'single_select',
  'multi_select',
  'date',
  'location',
  'media',
  'item_list',
  'reference',
]);

export const TemplateFieldSchema = z.object({
  key: z.string(),
  scope: z.enum(['order', 'provider_capability', 'asset']).default('order'),
  category_code: z.string().optional(),
  data_type: FieldType,
  label: TranslatableTextSchema,
  required: z.boolean().default(false),
  options: z
    .array(z.object({ value: z.string(), label: TranslatableTextSchema }))
    .optional(),
  validation: z.record(z.unknown()).optional(),
  visibility_rule: z.record(z.unknown()).optional(),
  reference_source: z.string().optional(),
  item_catalog_code: z.string().optional(),
  used_in_pricing: z.boolean().default(false),
  used_in_matching: z.boolean().default(false),
  match_rule: z.record(z.unknown()).optional(),
  sort_order: z.number().int().default(0),
});

export const TemplateStageSchema = z.object({
  code: z.string(),
  label: TranslatableTextSchema,
  maps_to: z.string(),
  sort_order: z.number().int(),
  actor: z.enum(['agent', 'customer', 'system', 'ops']).default('agent'),
  tracking_active: z.boolean().default(false),
  requires: z.record(z.unknown()).optional(),
  payment_action: z
    .enum(['none', 'authorize', 'capture', 'capture_partial', 'capture_pct', 'deposit', 'supplement'])
    .default('none'),
  notify: z.record(z.unknown()).optional(),
  sla_minutes: z.number().int().optional(),
});

export const TemplateTierSchema = z.object({
  code: z.string(),
  name: TranslatableTextSchema,
  description: TranslatableTextSchema.optional(),
  category_code: z.string().optional(),
  required_capabilities: z.record(z.unknown()).optional(),
  pricing_mode: z.enum(['upfront', 'metered', 'fixed', 'quote']).default('upfront'),
  payment_plan_code: z.string().optional(),
  max_stops: z.number().int().default(2),
  sort_order: z.number().int().default(0),
});

export const TemplatePayloadSchema = z.object({
  vertical: z.object({
    code: z.string(),
    name: TranslatableTextSchema,
    default_fulfillment: Fulfillment,
    default_tracking: Tracking,
    config: z.record(z.unknown()).optional(),
  }),
  categories: z
    .array(
      z.object({
        code: z.string(),
        name: TranslatableTextSchema,
        parent_code: z.string().optional(),
        fulfillment: Fulfillment.optional(),
        tracking: Tracking.optional(),
        sort_order: z.number().int().default(0),
      }),
    )
    .default([]),
  item_catalogs: z
    .array(
      z.object({
        code: z.string(),
        name: TranslatableTextSchema,
        items: z
          .array(
            z.object({
              code: z.string(),
              name: TranslatableTextSchema,
              size_class: z.string().optional(),
              pricing_units: z.number().default(1),
              attributes: z.record(z.unknown()).optional(),
              allow_custom: z.boolean().default(false),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  payment_plans: z
    .array(
      z.object({
        code: z.string(),
        kind: z.enum([
          'authorize_capture',
          'prepay',
          'deposit_then_balance',
          'milestones',
          'invoice',
          'reimbursable_purchase',
          'cash_on_delivery',
        ]),
        params: z.record(z.unknown()).optional(),
      }),
    )
    .default([]),
  workflow: z.object({
    name: TranslatableTextSchema,
    stages: z.array(TemplateStageSchema),
  }),
  fields: z.array(TemplateFieldSchema).default([]),
  tiers: z.array(TemplateTierSchema).default([]),
  requirements: z
    .array(
      z.object({
        category_code: z.string(),
        doc_type: z.string(),
        label: TranslatableTextSchema,
        applies_to: z.enum(['org', 'agent', 'asset']).default('org'),
        is_required: z.boolean().default(true),
        expires: z.boolean().default(false),
      }),
    )
    .default([]),
});

export type TemplatePayload = z.infer<typeof TemplatePayloadSchema>;
