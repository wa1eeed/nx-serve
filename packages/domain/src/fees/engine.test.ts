import { describe, expect, it } from 'vitest';
import { type FeeComponent, applyFees } from './engine.js';

const commission: FeeComponent = {
  code: 'platform_commission',
  bearer: 'provider',
  calc: 'percent',
  ratePct: 10,
  base: 'service_amount',
  vatMode: 'inclusive',
};

describe('applyFees', () => {
  it('deducts a provider-borne inclusive commission from the provider', () => {
    const r = applyFees({ currency: 'SAR', serviceAmountMinor: 10000n, components: [commission] });
    expect(r.providerDeductionMinor).toBe(1000n); // 10% of 100 SAR, VAT inclusive
    expect(r.customerChargeMinor).toBe(0n);
    expect(r.vatMinor).toBe(130n); // 1000 x 15/115
  });

  it('adds a customer-borne exclusive fee plus its VAT to the customer charge', () => {
    const r = applyFees({
      currency: 'SAR',
      serviceAmountMinor: 10000n,
      components: [{ code: 'service_fee', bearer: 'customer', calc: 'fixed', fixedAmountMinor: 500n, base: 'service_amount', vatMode: 'exclusive' }],
    });
    expect(r.customerChargeMinor).toBe(575n); // 5.00 + 15% VAT
    expect(r.providerDeductionMinor).toBe(0n);
  });

  it('clamps a fee to its min and max', () => {
    const r = applyFees({
      currency: 'SAR',
      serviceAmountMinor: 100000n,
      components: [{ code: 'capped', bearer: 'platform', calc: 'percent', ratePct: 50, maxAmountMinor: 2000n, base: 'service_amount', vatMode: 'exempt' }],
    });
    expect(r.platformFeeMinor).toBe(2000n);
  });

  it('exempt VAT adds no VAT', () => {
    const r = applyFees({
      currency: 'SAR',
      serviceAmountMinor: 10000n,
      components: [{ code: 'x', bearer: 'platform', calc: 'fixed', fixedAmountMinor: 1000n, base: 'service_amount', vatMode: 'exempt' }],
    });
    expect(r.vatMinor).toBe(0n);
  });
});
