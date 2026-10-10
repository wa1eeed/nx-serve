import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { money } from '../money/money.js';
import { type RateCard, authorizedAmount, computeFare } from './fare.js';

// The docs/09 towing worked example rate card (seed values), Riyadh luxury.
const towing: RateCard = {
  currency: 'SAR',
  baseFareMinor: 8000n,
  bookingFeeMinor: 0n,
  includedKm: 5,
  perKm: 4,
  approachPerKm: 2,
  approachFreeKm: 5,
  perMin: 0.5,
  freeWaitMin: 0,
  perWaitMin: 0,
  minimumFareMinor: 5000n,
  classMultiplier: 1.3,
  extraStopFeeMinor: 0n,
  rounding: 'nearest_1',
};

describe('computeFare (docs/09 worked example)', () => {
  it('charges wait time only beyond the free-wait allowance', () => {
    const rc: RateCard = { ...towing, classMultiplier: 1, perWaitMin: 2, freeWaitMin: 3 };
    const fare = computeFare({ rateCard: rc, trip: { distanceKm: 5, durationMin: 0, waitMin: 5 } });
    const wait = fare.lines.find((l) => l.code === 'wait');
    expect(wait?.amountMinor).toBe(400n); // (5 - 3) x 2 = 4.00 SAR, not 5 x 2
  });

  it('yields 264.00 SAR total and 304.00 SAR authorized', () => {
    const fare = computeFare({
      rateCard: towing,
      trip: { distanceKm: 22, durationMin: 30, approachKm: 8 },
      surgeMultiplier: 1.2,
    });
    expect(fare.serviceFareMinor).toBe(26400n);
    expect(authorizedAmount(money(fare.serviceFareMinor, 'SAR'), 15, 'nearest_1').amountMinor).toBe(30400n);
  });

  it('itemizes the base, distance, time and approach lines', () => {
    const fare = computeFare({ rateCard: towing, trip: { distanceKm: 22, durationMin: 30, approachKm: 8 } });
    const byCode = Object.fromEntries(fare.lines.map((l) => [l.code, l.amountMinor]));
    expect(byCode.base).toBe(8000n);
    expect(byCode.distance).toBe(6800n); // (22-5) x 4
    expect(byCode.time).toBe(1500n); // 30 x 0.5
    expect(byCode.approach).toBe(600n); // (8-5) x 2
  });

  it('applies the minimum fare', () => {
    const fare = computeFare({ rateCard: towing, trip: { distanceKm: 1, durationMin: 1 } });
    // base 80 + 0.5 time = 80.50 x 1.3 = 104.65 -> above min; use a tiny card instead.
    const tiny = computeFare({
      rateCard: { ...towing, baseFareMinor: 1000n, classMultiplier: 1 },
      trip: { distanceKm: 0, durationMin: 0 },
    });
    expect(tiny.serviceFareMinor).toBe(5000n); // clamped up to the 50 SAR minimum
    expect(fare.serviceFareMinor).toBeGreaterThan(0n);
  });

  it('a flat fare replaces the formula', () => {
    const fare = computeFare({
      rateCard: { ...towing, flatFareMinor: 15000n, classMultiplier: 1 },
      trip: { distanceKm: 99, durationMin: 99 },
    });
    expect(fare.serviceFareMinor).toBe(15000n);
  });

  it('a zone-to-zone fare overrides the formula', () => {
    const fare = computeFare({
      rateCard: towing,
      trip: { distanceKm: 99, durationMin: 99 },
      zoneToZoneFareMinor: 20000n,
      surgeMultiplier: 1.5,
    });
    // override replaces base formula; surge still applies: 200 x 1.5 = 300
    expect(fare.serviceFareMinor).toBe(30000n);
  });

  it('property: the service fare is never below the minimum or above the maximum', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 600 }),
        fc.integer({ min: 1, max: 100 }),
        (km, min, max) => {
          const rc: RateCard = {
            ...towing,
            minimumFareMinor: BigInt(min) * 100n,
            maximumFareMinor: BigInt(min + max) * 100n,
          };
          const fare = computeFare({ rateCard: rc, trip: { distanceKm: km, durationMin: km } });
          return fare.serviceFareMinor >= rc.minimumFareMinor && fare.serviceFareMinor <= (rc.maximumFareMinor ?? fare.serviceFareMinor);
        },
      ),
    );
  });
});
