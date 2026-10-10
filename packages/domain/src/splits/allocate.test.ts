import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { estimateGatewayFee } from '../fees/gateway.js';
import { allocateSplits, settle, splitsSum, type AllocateSplitsInput } from './allocate.js';

describe('allocateSplits (docs/06 worked example)', () => {
  it('provider 90 and platform 10 sum to the 100 payment, fee source provider', () => {
    const splits = allocateSplits({
      currency: 'SAR',
      paymentAmountMinor: 10000n,
      serviceAmountMinor: 10000n,
      providerDeductionMinor: 1000n, // 10% commission
      providerRef: 'merchant_1',
      platformRef: 'platform',
      feeSource: 'provider',
    });
    expect(splitsSum(splits)).toBe(10000n);
    const provider = splits.find((s) => s.recipientType === 'provider')!;
    const platform = splits.find((s) => s.recipientType === 'platform')!;
    expect(provider.amountMinor).toBe(9000n);
    expect(platform.amountMinor).toBe(1000n);
    expect(provider.isFeeSource).toBe(true);
    expect(platform.isFeeSource).toBe(false);
  });

  it('settles to provider 89.02, platform 10.00, gateway 0.98 on mada', () => {
    const splits = allocateSplits({
      currency: 'SAR',
      paymentAmountMinor: 10000n,
      serviceAmountMinor: 10000n,
      providerDeductionMinor: 1000n,
      providerRef: 'm',
      platformRef: 'p',
      feeSource: 'provider',
    });
    const gatewayFee = estimateGatewayFee({ ratePct: 0.85, fixedAmountMinor: 0n, vatPct: 15 }, 10000n);
    expect(gatewayFee).toBe(98n); // 0.98 SAR
    const s = settle(splits, gatewayFee, 'provider');
    expect(s.providerNetMinor).toBe(8902n);
    expect(s.platformNetMinor).toBe(1000n);
    expect(s.gatewayFeeMinor).toBe(98n);
  });

  it('with fee source platform, the platform absorbs the gateway fee', () => {
    const splits = allocateSplits({
      currency: 'SAR',
      paymentAmountMinor: 10000n,
      serviceAmountMinor: 10000n,
      providerDeductionMinor: 1000n,
      providerRef: 'm',
      platformRef: 'p',
      feeSource: 'platform',
    });
    const s = settle(splits, 98n, 'platform');
    expect(s.providerNetMinor).toBe(9000n);
    expect(s.platformNetMinor).toBe(902n);
  });

  it('property: splits always sum to the payment amount and the provider is never negative', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1000n, max: 1_000_000n }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        (service, commissionPct, customerFeePct) => {
          const commission = (service * BigInt(commissionPct)) / 100n;
          const customerCharge = (service * BigInt(customerFeePct)) / 100n;
          const payment = service + customerCharge;
          const input: AllocateSplitsInput = {
            currency: 'SAR',
            paymentAmountMinor: payment,
            serviceAmountMinor: service,
            providerDeductionMinor: commission,
            providerRef: 'm',
            platformRef: 'p',
            feeSource: 'provider',
          };
          const splits = allocateSplits(input);
          const provider = splits.find((s) => s.recipientType === 'provider')!;
          return splitsSum(splits) === payment && provider.amountMinor >= 0n;
        },
      ),
    );
  });
});
