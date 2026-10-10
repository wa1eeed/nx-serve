/**
 * Fare computation (docs/09 section 3, steps 1 to 8): the service fare for an
 * order, before platform fees and VAT. Pure: the API resolves the rate card, the
 * routed distance and duration from MapsProvider, the matched modifiers, the zone
 * surcharge or zone-to-zone override, and the combined surge; this composes them.
 */
import { type CurrencyCode } from '../money/currency.js';
import { type FareRounding, applyFareRounding } from '../money/fare.js';
import { addMoney, money, scaleMoney, sumMoney, type Money } from '../money/money.js';
import { applyCharge, clampMinor, rateCharge, type ChargeRule } from './types.js';

export interface RateCard {
  currency: CurrencyCode;
  baseFareMinor: bigint;
  bookingFeeMinor: bigint;
  includedKm: number;
  perKm: number;
  approachPerKm: number;
  approachFreeKm: number;
  perMin: number;
  freeWaitMin: number;
  perWaitMin: number;
  /** When set, a flat fare replaces the distance and time formula. */
  flatFareMinor?: bigint | null;
  minimumFareMinor: bigint;
  maximumFareMinor?: bigint | null;
  classMultiplier: number;
  extraStopFeeMinor: bigint;
  rounding: FareRounding;
}

export interface Trip {
  distanceKm: number;
  durationMin: number;
  approachKm?: number;
  waitMin?: number;
  /** Stops beyond those included in the base fare. */
  extraStops?: number;
}

export interface FareInput {
  rateCard: RateCard;
  trip: Trip;
  /** Conditional charges whose condition already matched the order (docs/09 step 4). */
  modifiers?: ChargeRule[];
  /** Zone surcharge on pickup or drop-off (docs/09 step 5). */
  zoneSurcharge?: ChargeRule | null;
  /** A fixed zone-to-zone fare that overrides the formula and modifiers (step 5). */
  zoneToZoneFareMinor?: bigint | null;
  /** Combined surge multiplier (>= 1), from the surge calculator (step 6). */
  surgeMultiplier?: number;
  /** Add-ons and item charges (step 7). */
  addonsMinor?: bigint;
}

export interface FareLine {
  code: string;
  amountMinor: bigint;
}

export interface Fare {
  currency: CurrencyCode;
  lines: FareLine[];
  /** The service fare after clamping and rounding (fees and VAT are separate). */
  serviceFareMinor: bigint;
}

export function computeFare(input: FareInput): Fare {
  const rc = input.rateCard;
  const cur = rc.currency;
  const trip = input.trip;
  const lines: FareLine[] = [];

  let fare: Money;

  if (input.zoneToZoneFareMinor !== undefined && input.zoneToZoneFareMinor !== null) {
    // Fixed zone-to-zone fare overrides the formula, modifiers and surcharge.
    fare = money(input.zoneToZoneFareMinor, cur);
    lines.push({ code: 'zone_to_zone', amountMinor: input.zoneToZoneFareMinor });
  } else {
    const parts: Money[] = [];
    const add = (code: string, amountMinor: bigint): void => {
      if (amountMinor !== 0n) {
        lines.push({ code, amountMinor });
        parts.push(money(amountMinor, cur));
      }
    };

    if (rc.flatFareMinor !== undefined && rc.flatFareMinor !== null) {
      add('flat', rc.flatFareMinor);
    } else {
      add('base', rc.baseFareMinor);
      add('distance', rateCharge(cur, rc.perKm, Math.max(0, trip.distanceKm - rc.includedKm)));
      add('time', rateCharge(cur, rc.perMin, trip.durationMin));
      add('approach', rateCharge(cur, rc.approachPerKm, Math.max(0, (trip.approachKm ?? 0) - rc.approachFreeKm)));
      add('wait', rateCharge(cur, rc.perWaitMin, Math.max(0, (trip.waitMin ?? 0) - rc.freeWaitMin)));
    }
    add('booking', rc.bookingFeeMinor);
    if (trip.extraStops && trip.extraStops > 0) add('extra_stops', rc.extraStopFeeMinor * BigInt(trip.extraStops));

    let subtotal = sumMoney(parts, cur);

    for (const [i, mod] of (input.modifiers ?? []).entries()) {
      const charge = applyCharge(mod, subtotal.amountMinor);
      if (charge !== 0n) {
        lines.push({ code: `modifier_${i}`, amountMinor: charge });
        subtotal = addMoney(subtotal, money(charge, cur));
      }
    }

    // Vehicle-class multiplier (step 4).
    subtotal = scaleMoney(subtotal, rc.classMultiplier);

    if (input.zoneSurcharge) {
      const charge = applyCharge(input.zoneSurcharge, subtotal.amountMinor);
      if (charge !== 0n) {
        lines.push({ code: 'zone_surcharge', amountMinor: charge });
        subtotal = addMoney(subtotal, money(charge, cur));
      }
    }
    fare = subtotal;
  }

  // Surge (step 6).
  const surge = input.surgeMultiplier ?? 1;
  if (surge !== 1) {
    const before = fare.amountMinor;
    fare = scaleMoney(fare, surge);
    lines.push({ code: 'surge', amountMinor: fare.amountMinor - before });
  }

  // Add-ons (step 7).
  if (input.addonsMinor && input.addonsMinor !== 0n) {
    lines.push({ code: 'addons', amountMinor: input.addonsMinor });
    fare = addMoney(fare, money(input.addonsMinor, cur));
  }

  // Clamp then round (step 8).
  const clamped = clampMinor(fare.amountMinor, rc.minimumFareMinor, rc.maximumFareMinor);
  const rounded = applyFareRounding(money(clamped, cur), rc.rounding);
  return { currency: cur, lines, serviceFareMinor: rounded.amountMinor };
}

/** The authorized amount: fare times (1 + buffer), rounded (docs/09 step 10). */
export function authorizedAmount(fare: Money, bufferPct: number, rounding: FareRounding): Money {
  return applyFareRounding(scaleMoney(fare, 1 + bufferPct / 100), rounding);
}
