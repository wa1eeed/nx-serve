import { z } from 'zod';

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
