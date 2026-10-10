import { describe, expect, it } from 'vitest';
import { type SimulateRequestDto } from '@nxserve/contracts';
import { PricingService } from './pricing.service.js';

// simulate() is pure: it never touches the DB or integrations, so a bare instance
// exercises the full HTTP-DTO to engine mapping without a database.
const svc = new PricingService(null as never, null as never);

const towingSim: SimulateRequestDto = {
  rate_card: {
    currency: 'SAR',
    base_fare_minor: '8000',
    booking_fee_minor: '0',
    included_km: 5,
    per_km: 4,
    approach_per_km: 2,
    approach_free_km: 5,
    per_min: 0.5,
    free_wait_min: 0,
    per_wait_min: 0,
    minimum_fare_minor: '5000',
    class_multiplier: 1.3,
    extra_stop_fee_minor: '0',
    auth_buffer_pct: 15,
    rounding: 'nearest_1',
  },
  fee_components: [
    { code: 'platform_commission', bearer: 'provider', calc: 'percent', rate_pct: 10, base: 'service_amount', vat_mode: 'inclusive', refundable: true },
  ],
  trip: { distance_km: 22, duration_min: 30, approach_km: 8 },
  surge_multiplier: 1.2,
  addons_minor: '0',
  gateway: { rate_pct: 0.85, fixed_amount_minor: '0', vat_pct: 15 },
  fee_source: 'provider',
  provider_ref: 'merchant_1',
  platform_ref: 'platform',
};

describe('PricingService.simulate (docs worked examples through the HTTP contract)', () => {
  it('reproduces the towing fare, splits and settlement exactly', () => {
    const r = svc.simulate(towingSim);
    expect(r.service_fare_minor).toBe('26400'); // 264.00 SAR
    expect(r.customer_total_minor).toBe('26400'); // commission is provider-borne
    expect(r.authorized_minor).toBe('30400'); // 304.00 SAR
    expect(r.provider_deduction_minor).toBe('2640'); // 10% of 264

    const provider = r.splits.find((s) => s.recipient_type === 'provider')!;
    const platform = r.splits.find((s) => s.recipient_type === 'platform')!;
    expect(provider.amount_minor).toBe('23760'); // 264 - 26.40
    expect(platform.amount_minor).toBe('2640');
    expect(BigInt(provider.amount_minor) + BigInt(platform.amount_minor)).toBe(26400n);
    expect(provider.is_fee_source).toBe(true);

    // Gateway fee on 264 SAR at mada 0.85% + 15% VAT.
    expect(BigInt(r.settlement.gateway_fee_minor)).toBeGreaterThan(0n);
    expect(BigInt(r.settlement.provider_net_minor)).toBe(BigInt(provider.amount_minor) - BigInt(r.settlement.gateway_fee_minor));
  });

  it('matches the 100 SAR split example when priced as a flat fare', () => {
    const r = svc.simulate({
      ...towingSim,
      rate_card: { ...towingSim.rate_card, flat_fare_minor: '10000', class_multiplier: 1 },
      trip: { distance_km: 0, duration_min: 0 },
      surge_multiplier: 1,
    });
    expect(r.customer_total_minor).toBe('10000'); // 100.00 SAR
    const provider = r.splits.find((s) => s.recipient_type === 'provider')!;
    const platform = r.splits.find((s) => s.recipient_type === 'platform')!;
    expect(provider.amount_minor).toBe('9000');
    expect(platform.amount_minor).toBe('1000');
    expect(r.settlement.gateway_fee_minor).toBe('98'); // 0.98 SAR
    expect(r.settlement.provider_net_minor).toBe('8902'); // 89.02 SAR
    expect(r.settlement.platform_net_minor).toBe('1000'); // 10.00 SAR
  });
});
