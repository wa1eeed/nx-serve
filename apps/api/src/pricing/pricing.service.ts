import { Inject, Injectable } from '@nestjs/common';
import { type PoolClient } from '@nxserve/db';
import {
  type FeeComponent,
  type GatewayFeeRate,
  type RateCard,
  allocateSplits,
  estimate as estimateFare,
  estimateGatewayFee,
  settle,
  uuidv7,
} from '@nxserve/domain';
import {
  type EstimateRequestDto,
  type EstimateResponse,
  type SimulateRequestDto,
  type SimulateResponse,
} from '@nxserve/contracts';
import { type Integrations } from '@nxserve/integrations';
import { DbService } from '../db/db.service.js';
import { AppException } from '../common/app-exception.js';
import { INTEGRATIONS } from '../integrations/integrations.module.js';

const ESTIMATE_TTL_MS = 5 * 60 * 1000;

const minor = (s: string): bigint => BigInt(s);
const str = (b: bigint): string => b.toString();

/** Pricing: a customer estimate (resolved and stored) and an admin simulator. */
@Injectable()
export class PricingService {
  constructor(
    private readonly db: DbService,
    @Inject(INTEGRATIONS) private readonly integrations: Integrations,
  ) {}

  /** The admin fee and price simulator (docs/09 section 8): pure, nothing stored. */
  simulate(dto: SimulateRequestDto): SimulateResponse {
    const rateCard = toRateCard(dto.rate_card);
    const components = dto.fee_components.map(toFeeComponent);
    const est = estimateFare({
      rateCard,
      trip: {
        distanceKm: dto.trip.distance_km,
        durationMin: dto.trip.duration_min,
        ...(dto.trip.approach_km !== undefined ? { approachKm: dto.trip.approach_km } : {}),
        ...(dto.trip.wait_min !== undefined ? { waitMin: dto.trip.wait_min } : {}),
        ...(dto.trip.extra_stops !== undefined ? { extraStops: dto.trip.extra_stops } : {}),
      },
      surgeMultiplier: dto.surge_multiplier,
      addonsMinor: minor(dto.addons_minor),
      feeComponents: components,
      authBufferPct: dto.rate_card.auth_buffer_pct,
    });

    const payment = est.customerTotalMinor;
    const splits = allocateSplits({
      currency: rateCard.currency,
      paymentAmountMinor: payment,
      serviceAmountMinor: est.serviceFareMinor,
      providerDeductionMinor: est.providerDeductionMinor,
      providerRef: dto.provider_ref,
      platformRef: dto.platform_ref,
      feeSource: dto.fee_source,
    });
    const gatewayFee = dto.gateway ? estimateGatewayFee(toGatewayRate(dto.gateway), payment) : 0n;
    const settlement = settle(splits, gatewayFee, dto.fee_source, est.platformFeeMinor);

    return {
      currency: rateCard.currency,
      service_fare_minor: str(est.serviceFareMinor),
      customer_total_minor: str(est.customerTotalMinor),
      authorized_minor: str(est.authorizedMinor),
      provider_deduction_minor: str(est.providerDeductionMinor),
      platform_fee_minor: str(est.platformFeeMinor),
      vat_minor: str(est.vatMinor),
      fare_lines: est.fareLines.map((l) => ({ code: l.code, amount_minor: str(l.amountMinor) })),
      fee_lines: est.feeLines.map((l) => ({ code: l.code, bearer: l.bearer, amount_minor: str(l.amountMinor), vat_minor: str(l.vatMinor), vat_mode: l.vatMode })),
      splits: splits.map((s) => ({ recipient_type: s.recipientType, recipient_ref: s.recipientRef, amount_minor: str(s.amountMinor), is_fee_source: s.isFeeSource, refundable: s.refundable })),
      settlement: {
        provider_net_minor: str(settlement.providerNetMinor),
        platform_net_minor: str(settlement.platformNetMinor),
        gateway_fee_minor: str(settlement.gatewayFeeMinor),
      },
    };
  }

  /** A customer estimate: resolve the rate card and route, compute, and store it. */
  async estimate(tenantId: string, nowIso: string, dto: EstimateRequestDto): Promise<EstimateResponse> {
    const route = await this.integrations.maps.route(dto.stops.map((s) => ({ lat: s.lat, lng: s.lng })));

    return this.db.withTenant(tenantId, async (client) => {
      const rateCardRow = await resolveRateCard(client, dto);
      if (!rateCardRow) throw new AppException('not_found', { detail: 'No active rate card for this scope' });
      const rateCard = rateCardRowToDomain(rateCardRow);

      const surgeMultiplier = await resolveSurge(client, dto, nowIso);
      const components = await resolveFeeComponents(client, dto);

      const est = estimateFare({
        rateCard,
        trip: { distanceKm: route.totalDistanceKm, durationMin: route.totalDurationMin },
        surgeMultiplier,
        addonsMinor: minor(dto.addons_minor),
        feeComponents: components,
        authBufferPct: Number(rateCardRow.auth_buffer_pct),
      });

      const id = uuidv7();
      const expiresAt = new Date(new Date(nowIso).getTime() + ESTIMATE_TTL_MS).toISOString();
      const breakdown = { fare: est.fareLines.map((l) => ({ code: l.code, amount_minor: str(l.amountMinor) })), fees: est.feeLines.map((l) => ({ code: l.code, bearer: l.bearer, amount_minor: str(l.amountMinor) })) };
      const inputs = { distance_km: route.totalDistanceKm, duration_min: route.totalDurationMin, stops: dto.stops, attributes: dto.attributes, addons_minor: dto.addons_minor };

      await client.query(
        `INSERT INTO price_estimates
           (id, tenant_id, vertical_id, category_id, tier_id, city_id, zone_id, vehicle_class_id, currency,
            inputs, breakdown, service_fare_minor, customer_total_minor, authorized_minor, surge_multiplier,
            rate_card_id, rate_card_version, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17,$18)`,
        [
          id, tenantId, dto.vertical_id ?? null, dto.category_id ?? null, dto.tier_id, dto.city_id ?? null,
          dto.zone_id ?? null, dto.vehicle_class_id ?? null, rateCard.currency, JSON.stringify(inputs),
          JSON.stringify(breakdown), str(est.serviceFareMinor), str(est.customerTotalMinor), str(est.authorizedMinor),
          surgeMultiplier, rateCardRow.id, rateCardRow.version, expiresAt,
        ],
      );

      return {
        estimate_id: id,
        currency: rateCard.currency,
        service_fare_minor: str(est.serviceFareMinor),
        customer_total_minor: str(est.customerTotalMinor),
        authorized_minor: str(est.authorizedMinor),
        surge_multiplier: surgeMultiplier,
        requires_surge_ack: surgeMultiplier > 1 && !dto.surge_ack,
        distance_km: route.totalDistanceKm,
        duration_min: route.totalDurationMin,
        fare_lines: est.fareLines.map((l) => ({ code: l.code, amount_minor: str(l.amountMinor) })),
        fee_lines: est.feeLines.map((l) => ({ code: l.code, bearer: l.bearer, amount_minor: str(l.amountMinor), vat_minor: str(l.vatMinor), vat_mode: l.vatMode })),
        expires_at: expiresAt,
      };
    });
  }
}

// --- Input mappers (simulator) ---

function toRateCard(r: SimulateRequestDto['rate_card']): RateCard {
  return {
    currency: r.currency,
    baseFareMinor: minor(r.base_fare_minor),
    bookingFeeMinor: minor(r.booking_fee_minor),
    includedKm: r.included_km,
    perKm: r.per_km,
    approachPerKm: r.approach_per_km,
    approachFreeKm: r.approach_free_km,
    perMin: r.per_min,
    freeWaitMin: r.free_wait_min,
    perWaitMin: r.per_wait_min,
    flatFareMinor: r.flat_fare_minor !== undefined && r.flat_fare_minor !== null ? minor(r.flat_fare_minor) : null,
    minimumFareMinor: minor(r.minimum_fare_minor),
    maximumFareMinor: r.maximum_fare_minor !== undefined && r.maximum_fare_minor !== null ? minor(r.maximum_fare_minor) : null,
    classMultiplier: r.class_multiplier,
    extraStopFeeMinor: minor(r.extra_stop_fee_minor),
    rounding: r.rounding,
  };
}

function toFeeComponent(c: SimulateRequestDto['fee_components'][number]): FeeComponent {
  return {
    code: c.code,
    bearer: c.bearer,
    calc: c.calc,
    ...(c.rate_pct !== undefined ? { ratePct: c.rate_pct } : {}),
    ...(c.fixed_amount_minor !== undefined ? { fixedAmountMinor: minor(c.fixed_amount_minor) } : {}),
    ...(c.min_amount_minor !== undefined && c.min_amount_minor !== null ? { minAmountMinor: minor(c.min_amount_minor) } : {}),
    ...(c.max_amount_minor !== undefined && c.max_amount_minor !== null ? { maxAmountMinor: minor(c.max_amount_minor) } : {}),
    base: c.base,
    vatMode: c.vat_mode,
    ...(c.vat_pct !== undefined ? { vatPct: c.vat_pct } : {}),
    refundable: c.refundable,
  };
}

function toGatewayRate(g: NonNullable<SimulateRequestDto['gateway']>): GatewayFeeRate {
  return {
    ratePct: g.rate_pct,
    fixedAmountMinor: minor(g.fixed_amount_minor),
    capAmountMinor: g.cap_amount_minor !== undefined && g.cap_amount_minor !== null ? minor(g.cap_amount_minor) : null,
    vatPct: g.vat_pct,
  };
}

// --- DB resolution (estimate) ---

interface RateCardRow {
  id: string;
  version: number;
  currency: string;
  base_fare_minor: string;
  booking_fee_minor: string;
  included_km: string;
  per_km: string;
  approach_per_km: string;
  approach_free_km: string;
  per_min: string;
  free_wait_min: number;
  per_wait_min: string;
  flat_fare_minor: string | null;
  minimum_fare_minor: string;
  maximum_fare_minor: string | null;
  class_multiplier: string;
  extra_stop_fee_minor: string;
  auth_buffer_pct: string;
  rounding: RateCard['rounding'];
}

async function resolveRateCard(client: PoolClient, dto: EstimateRequestDto): Promise<RateCardRow | null> {
  // Most-specific-wins: a card with a matching zone, then vehicle class, then city.
  const res = await client.query<RateCardRow>(
    `SELECT id, version, currency, base_fare_minor, booking_fee_minor, included_km, per_km, approach_per_km,
            approach_free_km, per_min, free_wait_min, per_wait_min, flat_fare_minor, minimum_fare_minor,
            maximum_fare_minor, class_multiplier, extra_stop_fee_minor, auth_buffer_pct, rounding
     FROM rate_cards
     WHERE tier_id = $1 AND status = 'active'
       AND (city_id = $2 OR city_id IS NULL)
       AND (zone_id = $3 OR zone_id IS NULL)
       AND (vehicle_class_id = $4 OR vehicle_class_id IS NULL)
       AND (valid_from IS NULL OR valid_from <= now())
       AND (valid_to IS NULL OR valid_to >= now())
     ORDER BY (zone_id IS NOT NULL) DESC, (vehicle_class_id IS NOT NULL) DESC, (city_id IS NOT NULL) DESC, version DESC
     LIMIT 1`,
    [dto.tier_id, dto.city_id ?? null, dto.zone_id ?? null, dto.vehicle_class_id ?? null],
  );
  return res.rows[0] ?? null;
}

function rateCardRowToDomain(r: RateCardRow): RateCard {
  return {
    currency: r.currency,
    baseFareMinor: BigInt(r.base_fare_minor),
    bookingFeeMinor: BigInt(r.booking_fee_minor),
    includedKm: Number(r.included_km),
    perKm: Number(r.per_km),
    approachPerKm: Number(r.approach_per_km),
    approachFreeKm: Number(r.approach_free_km),
    perMin: Number(r.per_min),
    freeWaitMin: Number(r.free_wait_min),
    perWaitMin: Number(r.per_wait_min),
    flatFareMinor: r.flat_fare_minor !== null ? BigInt(r.flat_fare_minor) : null,
    minimumFareMinor: BigInt(r.minimum_fare_minor),
    maximumFareMinor: r.maximum_fare_minor !== null ? BigInt(r.maximum_fare_minor) : null,
    classMultiplier: Number(r.class_multiplier),
    extraStopFeeMinor: BigInt(r.extra_stop_fee_minor),
    rounding: r.rounding,
  };
}

async function resolveSurge(client: PoolClient, dto: EstimateRequestDto, nowIso: string): Promise<number> {
  const at = new Date(nowIso);
  const dow = at.getUTCDay(); // 0..6
  const time = at.toISOString().slice(11, 19); // HH:MM:SS UTC
  const date = at.toISOString().slice(0, 10);
  const res = await client.query<{ multiplier: string }>(
    `SELECT multiplier FROM surge_schedules
     WHERE is_active = true
       AND (tier_id = $1 OR tier_id IS NULL)
       AND (city_id = $2 OR city_id IS NULL)
       AND (zone_id = $3 OR zone_id IS NULL)
       AND ($4 = ANY(days_of_week) OR array_length(days_of_week, 1) IS NULL)
       AND (time_from IS NULL OR time_from <= $5::time)
       AND (time_to IS NULL OR time_to >= $5::time)
       AND (date_from IS NULL OR date_from <= $6::date)
       AND (date_to IS NULL OR date_to >= $6::date)`,
    [dto.tier_id, dto.city_id ?? null, dto.zone_id ?? null, dow, time, date],
  );
  return res.rows.reduce((m, r) => Math.max(m, Number(r.multiplier)), 1);
}

interface FeeComponentRow {
  code: string;
  bearer: FeeComponent['bearer'];
  calc: FeeComponent['calc'];
  rate_pct: string | null;
  fixed_amount_minor: string | null;
  min_amount_minor: string | null;
  max_amount_minor: string | null;
  base: FeeComponent['base'];
  vat_mode: FeeComponent['vatMode'];
  refundable: boolean;
}

async function resolveFeeComponents(client: PoolClient, dto: EstimateRequestDto): Promise<FeeComponent[]> {
  // The most-specific active fee schedule for the scope, then its components.
  const schedule = await client.query<{ id: string }>(
    `SELECT id FROM fee_schedules
     WHERE status = 'active'
       AND (vertical_id = $1 OR vertical_id IS NULL)
       AND (category_id = $2 OR category_id IS NULL)
       AND (city_id = $3 OR city_id IS NULL)
       AND (zone_id = $4 OR zone_id IS NULL)
       AND (valid_from IS NULL OR valid_from <= now())
       AND (valid_to IS NULL OR valid_to >= now())
     ORDER BY (zone_id IS NOT NULL) DESC, (city_id IS NOT NULL) DESC, (category_id IS NOT NULL) DESC, priority DESC, version DESC
     LIMIT 1`,
    [dto.vertical_id ?? null, dto.category_id ?? null, dto.city_id ?? null, dto.zone_id ?? null],
  );
  const scheduleId = schedule.rows[0]?.id;
  if (!scheduleId) return [];
  const res = await client.query<FeeComponentRow>(
    `SELECT code, bearer, calc, rate_pct, fixed_amount_minor, min_amount_minor, max_amount_minor, base, vat_mode, refundable
     FROM fee_components WHERE schedule_id = $1 ORDER BY sort_order`,
    [scheduleId],
  );
  return res.rows.map((r) => ({
    code: r.code,
    bearer: r.bearer,
    calc: r.calc,
    ...(r.rate_pct !== null ? { ratePct: Number(r.rate_pct) } : {}),
    ...(r.fixed_amount_minor !== null ? { fixedAmountMinor: BigInt(r.fixed_amount_minor) } : {}),
    ...(r.min_amount_minor !== null ? { minAmountMinor: BigInt(r.min_amount_minor) } : {}),
    ...(r.max_amount_minor !== null ? { maxAmountMinor: BigInt(r.max_amount_minor) } : {}),
    base: r.base,
    vatMode: r.vat_mode,
    refundable: r.refundable,
  }));
}
