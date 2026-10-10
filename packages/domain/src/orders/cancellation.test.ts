import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { type CancellationMoment, resolveCancellation } from './cancellation.js';

const policy = { cancellationFeeMinor: 2000n, minimumFareMinor: 5000n, authorizedMinor: 30400n };

describe('resolveCancellation (docs/07 section 6)', () => {
  it('is free before assignment (nothing authorized)', () => {
    const o = resolveCancellation('before_assignment', policy);
    expect(o.action).toBe('none');
    expect(o.chargeMinor).toBe(0n);
  });

  it('voids within the free window (reverses the authorization and splits)', () => {
    const o = resolveCancellation('within_free', policy);
    expect(o.action).toBe('void');
    expect(o.chargeMinor).toBe(0n);
  });

  it('takes the cancellation fee by partial capture after the free window', () => {
    const o = resolveCancellation('after_free', policy);
    expect(o.action).toBe('partial_capture');
    expect(o.chargeMinor).toBe(2000n);
  });

  it('takes the greater of the fee and the minimum fare after arrival', () => {
    const o = resolveCancellation('after_arrival', policy);
    expect(o.action).toBe('partial_capture');
    expect(o.chargeMinor).toBe(5000n); // minimum fare > fee
  });

  it('is free to the customer and re-dispatches on a provider cancel', () => {
    const o = resolveCancellation('provider_cancel', policy);
    expect(o.action).toBe('void');
    expect(o.reDispatch).toBe(true);
    expect(o.customerFault).toBe(false);
  });

  it('voids when the fee is zero but an authorization is held', () => {
    const o = resolveCancellation('after_free', { cancellationFeeMinor: 0n, minimumFareMinor: 0n, authorizedMinor: 30400n });
    expect(o.action).toBe('void');
    expect(o.chargeMinor).toBe(0n);
  });

  it('is a no-op when the fee is zero and nothing was authorized', () => {
    const o = resolveCancellation('after_free', { cancellationFeeMinor: 0n, minimumFareMinor: 0n });
    expect(o.action).toBe('none');
    expect(o.chargeMinor).toBe(0n);
  });

  it('refuses a non-zero fee without a known authorization ceiling', () => {
    expect(() => resolveCancellation('after_arrival', { cancellationFeeMinor: 2000n, minimumFareMinor: 80000n })).toThrow(/authorized/);
  });

  it('clamps the fee to the authorized amount', () => {
    const o = resolveCancellation('after_arrival', { cancellationFeeMinor: 99999n, minimumFareMinor: 99999n, authorizedMinor: 10000n });
    expect(o.chargeMinor).toBe(10000n);
  });
});

describe('property: a captured fee never exceeds the authorized amount and is never negative', () => {
  it('holds for all moments and policies', () => {
    const moments: CancellationMoment[] = ['before_assignment', 'within_free', 'after_free', 'after_arrival', 'provider_cancel'];
    fc.assert(
      fc.property(
        fc.constantFrom(...moments),
        fc.bigInt({ min: -100n, max: 100000n }),
        fc.bigInt({ min: 0n, max: 100000n }),
        fc.bigInt({ min: 0n, max: 50000n }),
        (moment, fee, minFare, authorized) => {
          const o = resolveCancellation(moment, { cancellationFeeMinor: fee, minimumFareMinor: minFare, authorizedMinor: authorized });
          return o.chargeMinor >= 0n && o.chargeMinor <= authorized && (o.action === 'partial_capture' ? o.chargeMinor > 0n : o.chargeMinor === 0n);
        },
      ),
    );
  });
});
