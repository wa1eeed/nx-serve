import { describe, expect, it } from 'vitest';
import { type FeeComponent } from '../fees/engine.js';
import { type RateCard } from './fare.js';
import { estimate } from './estimate.js';

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

const commission: FeeComponent = {
  code: 'platform_commission',
  bearer: 'provider',
  calc: 'percent',
  ratePct: 10,
  base: 'service_amount',
  vatMode: 'inclusive',
};

describe('estimate', () => {
  it('composes the towing fare, a provider-borne commission and the auth buffer', () => {
    const e = estimate({
      rateCard: towing,
      trip: { distanceKm: 22, durationMin: 30, approachKm: 8 },
      surgeMultiplier: 1.2,
      feeComponents: [commission],
      authBufferPct: 15,
    });
    expect(e.serviceFareMinor).toBe(26400n); // 264.00 SAR
    // Provider-borne commission does not change the customer total.
    expect(e.customerChargeMinor).toBe(0n);
    expect(e.customerTotalMinor).toBe(26400n);
    expect(e.authorizedMinor).toBe(30400n); // 304.00 SAR
    expect(e.providerDeductionMinor).toBe(2640n); // 10% of 264
  });

  it('a customer-borne fee raises the customer total and the authorized amount', () => {
    const e = estimate({
      rateCard: towing,
      trip: { distanceKm: 22, durationMin: 30, approachKm: 8 },
      surgeMultiplier: 1.2,
      feeComponents: [{ code: 'booking', bearer: 'customer', calc: 'fixed', fixedAmountMinor: 500n, base: 'service_amount', vatMode: 'exempt' }],
      authBufferPct: 15,
    });
    expect(e.customerTotalMinor).toBe(26900n); // 264 + 5
    expect(e.authorizedMinor).toBe(30900n); // 269 x 1.15 = 309.35, rounded to 309.00
  });

  it('bases fees on the service-only amount so add-ons are not double counted', () => {
    // Flat service fare 100.00 with add-ons 20.00 (fare = 120.00).
    const flat: RateCard = { ...towing, flatFareMinor: 10000n, classMultiplier: 1, rounding: 'none' };
    const e = estimate({
      rateCard: flat,
      trip: { distanceKm: 0, durationMin: 0 },
      addonsMinor: 2000n,
      feeComponents: [
        { code: 'on_service', bearer: 'provider', calc: 'percent', ratePct: 10, base: 'service_amount', vatMode: 'exempt' },
        { code: 'on_total', bearer: 'platform', calc: 'percent', ratePct: 10, base: 'order_total', vatMode: 'exempt' },
      ],
      authBufferPct: 0,
    });
    expect(e.serviceFareMinor).toBe(12000n); // fare includes add-ons
    const onService = e.feeLines.find((l) => l.code === 'on_service')!;
    const onTotal = e.feeLines.find((l) => l.code === 'on_total')!;
    expect(onService.amountMinor).toBe(1000n); // 10% of service-only 100.00
    expect(onTotal.amountMinor).toBe(1200n); // 10% of order total 120.00, not 140.00
  });
});
