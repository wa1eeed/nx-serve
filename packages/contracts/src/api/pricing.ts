import { z } from 'zod';
import { TranslatableTextSchema } from '../http.js';

/**
 * Pricing and fee contracts (docs/09). Money is integer minor units serialized as
 * a string to preserve bigint precision (matching MoneySchema in http.ts); rates
 * and multipliers are numbers. The estimate request carries the trip and scope to
 * resolve the rate card and route; the simulator takes the inputs directly so the
 * console can price what-if scenarios without persisting anything.
 */

const MinorAmount = z.string().regex(/^-?\d+$/, 'minor amount is an integer serialised as a string');
const NonNegMinor = z.string().regex(/^\d+$/, 'minor amount is a non-negative integer string');

export const FareRoundingSchema = z.enum(['none', 'nearest_0_5', 'nearest_1', 'up_5']);
export const FeeCalcSchema = z.enum(['percent', 'fixed', 'percent_plus_fixed']);
export const FeeBearerSchema = z.enum(['customer', 'provider', 'platform']);
export const VatModeSchema = z.enum(['exclusive', 'inclusive', 'exempt']);
export const FeeBaseSchema = z.enum(['service_amount', 'addons', 'order_total']);

export const StopSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** A rate card as the engine and the simulator consume it. */
export const RateCardInputSchema = z.object({
  currency: z.string().length(3),
  base_fare_minor: NonNegMinor,
  booking_fee_minor: NonNegMinor.default('0'),
  included_km: z.number().min(0),
  per_km: z.number().min(0),
  approach_per_km: z.number().min(0).default(0),
  approach_free_km: z.number().min(0).default(0),
  per_min: z.number().min(0).default(0),
  free_wait_min: z.number().min(0).default(0),
  per_wait_min: z.number().min(0).default(0),
  flat_fare_minor: NonNegMinor.nullable().optional(),
  minimum_fare_minor: NonNegMinor.default('0'),
  maximum_fare_minor: NonNegMinor.nullable().optional(),
  class_multiplier: z.number().positive().default(1),
  extra_stop_fee_minor: NonNegMinor.default('0'),
  auth_buffer_pct: z.number().min(0).default(15),
  rounding: FareRoundingSchema.default('nearest_1'),
});
export type RateCardInputDto = z.infer<typeof RateCardInputSchema>;

export const FeeComponentInputSchema = z.object({
  code: z.string().min(1).max(64),
  bearer: FeeBearerSchema,
  calc: FeeCalcSchema,
  rate_pct: z.number().min(0).optional(),
  fixed_amount_minor: MinorAmount.optional(),
  min_amount_minor: NonNegMinor.nullable().optional(),
  max_amount_minor: NonNegMinor.nullable().optional(),
  base: FeeBaseSchema.default('service_amount'),
  vat_mode: VatModeSchema.default('exclusive'),
  vat_pct: z.number().min(0).optional(),
  refundable: z.boolean().default(true),
});
export type FeeComponentInputDto = z.infer<typeof FeeComponentInputSchema>;

export const GatewayFeeRateInputSchema = z.object({
  rate_pct: z.number().min(0),
  fixed_amount_minor: NonNegMinor.default('0'),
  cap_amount_minor: NonNegMinor.nullable().optional(),
  vat_pct: z.number().min(0).default(15),
});
export type GatewayFeeRateInputDto = z.infer<typeof GatewayFeeRateInputSchema>;

// --- Estimate (resolves the rate card and routes from stops) ---

export const EstimateRequestSchema = z.object({
  vertical_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  tier_id: z.string().uuid(),
  city_id: z.string().uuid().optional(),
  zone_id: z.string().uuid().optional(),
  vehicle_class_id: z.string().uuid().optional(),
  stops: z.array(StopSchema).min(1),
  scheduled_at: z.string().datetime().optional(),
  attributes: z.record(z.unknown()).default({}),
  addons_minor: NonNegMinor.default('0'),
  surge_ack: z.boolean().default(false),
});
export type EstimateRequestDto = z.infer<typeof EstimateRequestSchema>;

export const FareLineSchema = z.object({ code: z.string(), amount_minor: MinorAmount });
export const FeeLineSchema = z.object({
  code: z.string(),
  bearer: FeeBearerSchema,
  amount_minor: MinorAmount,
  vat_minor: MinorAmount,
  vat_mode: VatModeSchema,
});

export const EstimateResponseSchema = z.object({
  estimate_id: z.string().uuid(),
  currency: z.string().length(3),
  service_fare_minor: MinorAmount,
  customer_total_minor: MinorAmount,
  authorized_minor: MinorAmount,
  surge_multiplier: z.number(),
  requires_surge_ack: z.boolean(),
  distance_km: z.number(),
  duration_min: z.number(),
  fare_lines: z.array(FareLineSchema),
  fee_lines: z.array(FeeLineSchema),
  expires_at: z.string().datetime(),
});
export type EstimateResponse = z.infer<typeof EstimateResponseSchema>;

// --- Simulator (direct inputs, nothing persisted) ---

export const SimulateRequestSchema = z.object({
  rate_card: RateCardInputSchema,
  fee_components: z.array(FeeComponentInputSchema).default([]),
  trip: z.object({
    distance_km: z.number().min(0),
    duration_min: z.number().min(0),
    approach_km: z.number().min(0).optional(),
    wait_min: z.number().min(0).optional(),
    extra_stops: z.number().int().min(0).optional(),
  }),
  surge_multiplier: z.number().min(1).default(1),
  addons_minor: NonNegMinor.default('0'),
  gateway: GatewayFeeRateInputSchema.optional(),
  fee_source: z.enum(['provider', 'platform']).default('provider'),
  provider_ref: z.string().default('provider'),
  platform_ref: z.string().default('platform'),
});
export type SimulateRequestDto = z.infer<typeof SimulateRequestSchema>;

export const SplitLineSchema = z.object({
  recipient_type: z.enum(['provider', 'platform', 'beneficiary']),
  recipient_ref: z.string(),
  amount_minor: MinorAmount,
  is_fee_source: z.boolean(),
  refundable: z.boolean(),
});

export const SimulateResponseSchema = z.object({
  currency: z.string().length(3),
  service_fare_minor: MinorAmount,
  customer_total_minor: MinorAmount,
  authorized_minor: MinorAmount,
  provider_deduction_minor: MinorAmount,
  platform_fee_minor: MinorAmount,
  vat_minor: MinorAmount,
  fare_lines: z.array(FareLineSchema),
  fee_lines: z.array(FeeLineSchema),
  splits: z.array(SplitLineSchema),
  settlement: z.object({
    provider_net_minor: MinorAmount,
    platform_net_minor: MinorAmount,
    gateway_fee_minor: MinorAmount,
  }),
});
export type SimulateResponse = z.infer<typeof SimulateResponseSchema>;

// =====================================================================
// Admin: rate cards, fee schedules and surge (docs/09). Rate cards and fee
// schedules carry money, so they use maker-checker: a staff member with
// pricing.edit creates a draft and submits it; a different staff member with
// pricing.approve approves it (the approver can never be the creator, enforced
// both here and by a DB CHECK). Surge schedules are configuration, edited under
// pricing.edit. Money is minor-unit strings; rates and multipliers are numbers.
// =====================================================================

/** The maker-checker lifecycle shared by rate cards and fee schedules. */
export const PricingStatusSchema = z.enum(['draft', 'pending_approval', 'active', 'archived']);
export type PricingStatus = z.infer<typeof PricingStatusSchema>;

/** Optional notes carried by approve and reject. */
export const PricingApprovalSchema = z.object({ notes: z.string().max(1000).optional() });
export type PricingApprovalDto = z.infer<typeof PricingApprovalSchema>;

const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'time is HH:MM or HH:MM:SS');
// z.string().date() validates a real calendar date (rejects 2025-13-45), so the
// string never reaches Postgres as an invalid date cast.
const CalendarDate = z.string().date();

// --- Rate cards ---

/** The editable fields of a rate card (docs/09 section 2). Created as a draft. */
export const CreateRateCardSchema = z.object({
  tier_id: z.string().uuid(),
  city_id: z.string().uuid(),
  zone_id: z.string().uuid().nullable().optional(),
  vehicle_class_id: z.string().uuid().nullable().optional(),
  currency: z.string().length(3).default('SAR'),
  base_fare_minor: NonNegMinor.default('0'),
  booking_fee_minor: NonNegMinor.default('0'),
  included_km: z.number().min(0).default(0),
  per_km: z.number().min(0).default(0),
  approach_per_km: z.number().min(0).default(0),
  approach_free_km: z.number().min(0).default(0),
  per_min: z.number().min(0).default(0),
  free_wait_min: z.number().int().min(0).default(0),
  per_wait_min: z.number().min(0).default(0),
  flat_fare_minor: NonNegMinor.nullable().optional(),
  minimum_fare_minor: NonNegMinor.default('0'),
  maximum_fare_minor: NonNegMinor.nullable().optional(),
  // Bounds mirror the rate_cards numeric(p,s) columns so out-of-range input is a
  // 422, not a Postgres overflow 500.
  class_multiplier: z.number().positive().max(999.999).default(1),
  extra_stop_fee_minor: NonNegMinor.default('0'),
  auth_buffer_pct: z.number().min(0).max(999.99).default(15),
  reprice_threshold_pct: z.number().min(0).max(999.99).default(20),
  rounding: FareRoundingSchema.default('nearest_1'),
  cancellation_fee_minor: NonNegMinor.default('0'),
  cancellation_free_min: z.number().int().min(0).default(2),
  valid_from: z.string().datetime().nullable().optional(),
  valid_to: z.string().datetime().nullable().optional(),
});
export type CreateRateCardDto = z.infer<typeof CreateRateCardSchema>;

export const UpdateRateCardSchema = CreateRateCardSchema.partial();
export type UpdateRateCardDto = z.infer<typeof UpdateRateCardSchema>;

export const RateCardDetailSchema = z.object({
  id: z.string().uuid(),
  tier_id: z.string().uuid(),
  city_id: z.string().uuid(),
  zone_id: z.string().uuid().nullable(),
  vehicle_class_id: z.string().uuid().nullable(),
  currency: z.string().length(3),
  base_fare_minor: NonNegMinor,
  booking_fee_minor: NonNegMinor,
  included_km: z.number(),
  per_km: z.number(),
  approach_per_km: z.number(),
  approach_free_km: z.number(),
  per_min: z.number(),
  free_wait_min: z.number(),
  per_wait_min: z.number(),
  flat_fare_minor: NonNegMinor.nullable(),
  minimum_fare_minor: NonNegMinor,
  maximum_fare_minor: NonNegMinor.nullable(),
  class_multiplier: z.number(),
  extra_stop_fee_minor: NonNegMinor,
  auth_buffer_pct: z.number(),
  reprice_threshold_pct: z.number(),
  rounding: FareRoundingSchema,
  cancellation_fee_minor: NonNegMinor,
  cancellation_free_min: z.number(),
  status: PricingStatusSchema,
  version: z.number(),
  valid_from: z.string().datetime().nullable(),
  valid_to: z.string().datetime().nullable(),
  created_by: z.string().uuid().nullable(),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().datetime().nullable(),
});
export type RateCardDetail = z.infer<typeof RateCardDetailSchema>;

export const RateCardSummarySchema = RateCardDetailSchema.pick({
  id: true,
  tier_id: true,
  city_id: true,
  zone_id: true,
  vehicle_class_id: true,
  currency: true,
  base_fare_minor: true,
  flat_fare_minor: true,
  minimum_fare_minor: true,
  status: true,
  version: true,
  valid_from: true,
  valid_to: true,
  created_by: true,
  approved_by: true,
});
export type RateCardSummary = z.infer<typeof RateCardSummarySchema>;

// --- Fee schedules and their components ---

/** One fee component as the console edits it (persisted into fee_components). */
export const FeeComponentConfigSchema = z
  .object({
    code: z.string().min(1).max(64),
    label: TranslatableTextSchema,
    bearer: FeeBearerSchema,
    // Bounded to the fee_components numeric(6,3) rate_pct column.
    calc: FeeCalcSchema,
    rate_pct: z.number().min(0).max(999.999).nullable().optional(),
    // A fee is a charge, never negative (negative amounts would break the split
    // balancing invariant); promotions are modelled elsewhere, not as a fee line.
    fixed_amount_minor: NonNegMinor.nullable().optional(),
    min_amount_minor: NonNegMinor.nullable().optional(),
    max_amount_minor: NonNegMinor.nullable().optional(),
    base: FeeBaseSchema.default('service_amount'),
    payment_method: z.string().max(32).nullable().optional(),
    vat_mode: VatModeSchema.default('exclusive'),
    refundable: z.boolean().default(true),
    show_to_customer: z.boolean().default(true),
    // Omitted means "use the array position"; an explicit 0 is honored. The
    // service resolves undefined to the index, so there is no default here.
    sort_order: z.number().int().min(0).optional(),
  })
  .superRefine((c, ctx) => {
    // Mirror the DB CHECKs so the API answers 422 with a clear field error.
    if ((c.calc === 'percent' || c.calc === 'percent_plus_fixed') && (c.rate_pct === null || c.rate_pct === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'rate_pct is required for a percent calc', path: ['rate_pct'] });
    }
    if ((c.calc === 'fixed' || c.calc === 'percent_plus_fixed') && (c.fixed_amount_minor === null || c.fixed_amount_minor === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fixed_amount_minor is required for a fixed calc', path: ['fixed_amount_minor'] });
    }
    // No surcharging: a customer-borne fee cannot vary by payment method.
    if (c.bearer === 'customer' && c.payment_method !== null && c.payment_method !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a customer-borne fee cannot vary by payment method (no surcharging)', path: ['payment_method'] });
    }
  });
export type FeeComponentConfigDto = z.infer<typeof FeeComponentConfigSchema>;

export const CreateFeeScheduleSchema = z.object({
  name: TranslatableTextSchema,
  vertical_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  city_id: z.string().uuid().nullable().optional(),
  zone_id: z.string().uuid().nullable().optional(),
  provider_org_id: z.string().uuid().nullable().optional(),
  currency: z.string().length(3).default('SAR'),
  // The gateway fee is borne by the provider or the platform, never the customer
  // (no card surcharging), matching the fee_schedules CHECK.
  gateway_fee_bearer: z.enum(['provider', 'platform']).default('platform'),
  priority: z.number().int().default(0),
  valid_from: z.string().datetime().nullable().optional(),
  valid_to: z.string().datetime().nullable().optional(),
  components: z.array(FeeComponentConfigSchema).default([]),
});
export type CreateFeeScheduleDto = z.infer<typeof CreateFeeScheduleSchema>;

export const UpdateFeeScheduleSchema = CreateFeeScheduleSchema.partial();
export type UpdateFeeScheduleDto = z.infer<typeof UpdateFeeScheduleSchema>;

export const FeeComponentDetailSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  label: TranslatableTextSchema,
  bearer: FeeBearerSchema,
  calc: FeeCalcSchema,
  rate_pct: z.number().nullable(),
  fixed_amount_minor: MinorAmount.nullable(),
  min_amount_minor: NonNegMinor.nullable(),
  max_amount_minor: NonNegMinor.nullable(),
  base: FeeBaseSchema,
  payment_method: z.string().nullable(),
  vat_mode: VatModeSchema,
  refundable: z.boolean(),
  show_to_customer: z.boolean(),
  sort_order: z.number(),
});
export type FeeComponentDetail = z.infer<typeof FeeComponentDetailSchema>;

export const FeeScheduleDetailSchema = z.object({
  id: z.string().uuid(),
  name: TranslatableTextSchema,
  vertical_id: z.string().uuid().nullable(),
  category_id: z.string().uuid().nullable(),
  city_id: z.string().uuid().nullable(),
  zone_id: z.string().uuid().nullable(),
  provider_org_id: z.string().uuid().nullable(),
  currency: z.string().length(3),
  gateway_fee_bearer: z.enum(['provider', 'platform']),
  priority: z.number(),
  status: PricingStatusSchema,
  version: z.number(),
  valid_from: z.string().datetime().nullable(),
  valid_to: z.string().datetime().nullable(),
  created_by: z.string().uuid().nullable(),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().datetime().nullable(),
  components: z.array(FeeComponentDetailSchema),
});
export type FeeScheduleDetail = z.infer<typeof FeeScheduleDetailSchema>;

export const FeeScheduleSummarySchema = FeeScheduleDetailSchema.omit({ components: true }).extend({
  component_count: z.number(),
});
export type FeeScheduleSummary = z.infer<typeof FeeScheduleSummarySchema>;

// --- Surge schedules (scheduled surge, docs/09 section 6) ---

export const CreateSurgeScheduleSchema = z.object({
  name: TranslatableTextSchema,
  tier_id: z.string().uuid().nullable().optional(),
  city_id: z.string().uuid().nullable().optional(),
  zone_id: z.string().uuid().nullable().optional(),
  days_of_week: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  time_from: TimeOfDay.nullable().optional(),
  time_to: TimeOfDay.nullable().optional(),
  date_from: CalendarDate.nullable().optional(),
  date_to: CalendarDate.nullable().optional(),
  // >= 1 (surge never discounts) and bounded to the surge_schedules numeric(4,2).
  multiplier: z.number().min(1).max(99.99),
  is_active: z.boolean().default(true),
});
export type CreateSurgeScheduleDto = z.infer<typeof CreateSurgeScheduleSchema>;

export const UpdateSurgeScheduleSchema = CreateSurgeScheduleSchema.partial();
export type UpdateSurgeScheduleDto = z.infer<typeof UpdateSurgeScheduleSchema>;

export const SurgeScheduleDetailSchema = z.object({
  id: z.string().uuid(),
  name: TranslatableTextSchema,
  tier_id: z.string().uuid().nullable(),
  city_id: z.string().uuid().nullable(),
  zone_id: z.string().uuid().nullable(),
  days_of_week: z.array(z.number()).nullable(),
  time_from: z.string().nullable(),
  time_to: z.string().nullable(),
  date_from: z.string().nullable(),
  date_to: z.string().nullable(),
  multiplier: z.number(),
  is_active: z.boolean(),
});
export type SurgeScheduleDetail = z.infer<typeof SurgeScheduleDetailSchema>;
