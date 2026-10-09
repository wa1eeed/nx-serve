import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CurrencyMismatchError, MoneyInvariantError, UnknownCurrencyError } from '../errors.js';
import { currencyExponent, isSupportedCurrency, minorPerMajor } from './currency.js';
import {
  addMoney,
  allocateMoney,
  compareMoney,
  isNegativeMoney,
  isZeroMoney,
  money,
  moneyFromMajor,
  negateMoney,
  scaleMoney,
  subMoney,
  sumMoney,
  zeroMoney,
} from './money.js';
import { applyFareRounding } from './fare.js';

describe('currency', () => {
  it('knows SAR as a 2 decimal currency', () => {
    expect(currencyExponent('SAR')).toBe(2);
    expect(minorPerMajor('SAR')).toBe(100n);
    expect(minorPerMajor('KWD')).toBe(1000n);
    expect(minorPerMajor('JPY')).toBe(1n);
  });

  it('is case insensitive and reports support', () => {
    expect(currencyExponent('sar')).toBe(2);
    expect(isSupportedCurrency('sar')).toBe(true);
    expect(isSupportedCurrency('XYZ')).toBe(false);
  });

  it('throws on an unknown currency', () => {
    expect(() => currencyExponent('XYZ')).toThrow(UnknownCurrencyError);
  });
});

describe('money construction', () => {
  it('normalises the currency code and validates it', () => {
    expect(money(100n, 'sar')).toEqual({ amountMinor: 100n, currency: 'SAR' });
    expect(zeroMoney('SAR').amountMinor).toBe(0n);
    expect(() => money(1n, 'XYZ')).toThrow(UnknownCurrencyError);
  });

  it('builds from major units with rounding', () => {
    expect(moneyFromMajor(264, 'SAR').amountMinor).toBe(26400n);
    expect(moneyFromMajor(2.675, 'SAR').amountMinor).toBe(268n);
    expect(moneyFromMajor(1, 'KWD').amountMinor).toBe(1000n);
    expect(moneyFromMajor(1.5, 'SAR', 'down').amountMinor).toBe(150n);
  });
});

describe('money arithmetic', () => {
  it('adds, subtracts and negates', () => {
    const a = money(10000n, 'SAR');
    const b = money(2500n, 'SAR');
    expect(addMoney(a, b).amountMinor).toBe(12500n);
    expect(subMoney(a, b).amountMinor).toBe(7500n);
    expect(negateMoney(a).amountMinor).toBe(-10000n);
  });

  it('rejects mixing currencies', () => {
    const sar = money(100n, 'SAR');
    const usd = money(100n, 'USD');
    expect(() => addMoney(sar, usd)).toThrow(CurrencyMismatchError);
    expect(() => subMoney(sar, usd)).toThrow(CurrencyMismatchError);
    expect(() => compareMoney(sar, usd)).toThrow(CurrencyMismatchError);
    expect(() => sumMoney([usd], 'SAR')).toThrow(CurrencyMismatchError);
  });

  it('compares and inspects', () => {
    const a = money(100n, 'SAR');
    const b = money(200n, 'SAR');
    expect(compareMoney(a, b)).toBe(-1);
    expect(compareMoney(b, a)).toBe(1);
    expect(compareMoney(a, money(100n, 'SAR'))).toBe(0);
    expect(isZeroMoney(zeroMoney('SAR'))).toBe(true);
    expect(isZeroMoney(a)).toBe(false);
    expect(isNegativeMoney(negateMoney(a))).toBe(true);
    expect(isNegativeMoney(a)).toBe(false);
  });

  it('sums lists including the empty list', () => {
    expect(sumMoney([], 'SAR').amountMinor).toBe(0n);
    expect(sumMoney([money(100n, 'SAR'), money(250n, 'SAR')], 'SAR').amountMinor).toBe(350n);
  });

  it('scales by a factor', () => {
    expect(scaleMoney(money(16900n, 'SAR'), 1.3).amountMinor).toBe(21970n);
  });
});

describe('allocateMoney', () => {
  it('validates inputs', () => {
    expect(() => allocateMoney(money(100n, 'SAR'), [])).toThrow(MoneyInvariantError);
    expect(() => allocateMoney(money(-1n, 'SAR'), [1n])).toThrow(MoneyInvariantError);
    expect(() => allocateMoney(money(100n, 'SAR'), [-1n, 2n])).toThrow(MoneyInvariantError);
    expect(() => allocateMoney(money(100n, 'SAR'), [0n, 0n])).toThrow(MoneyInvariantError);
  });

  it('distributes leftover minor units deterministically', () => {
    // 100 split 1:1:1 -> 34, 33, 33 (first largest remainder gets the extra unit).
    const parts = allocateMoney(money(100n, 'SAR'), [1n, 1n, 1n]);
    expect(parts.map((p) => p.amountMinor)).toEqual([34n, 33n, 33n]);
  });

  it('is exact when evenly divisible', () => {
    const parts = allocateMoney(money(90n, 'SAR'), [1n, 2n]);
    expect(parts.map((p) => p.amountMinor)).toEqual([30n, 60n]);
  });

  it('always sums back to the total (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 12n }),
        fc.array(fc.bigInt({ min: 0n, max: 100_000n }), { minLength: 1, maxLength: 8 }),
        (totalMinor, weights) => {
          const weightSum = weights.reduce((acc, w) => acc + w, 0n);
          fc.pre(weightSum > 0n);
          const total = money(totalMinor, 'SAR');
          const parts = allocateMoney(total, weights);
          const sum = parts.reduce((acc, p) => acc + p.amountMinor, 0n);
          expect(sum).toBe(totalMinor);
          for (const p of parts) {
            expect(p.amountMinor >= 0n).toBe(true);
          }
        },
      ),
    );
  });
});

describe('fare rounding', () => {
  it('applies each rule', () => {
    expect(applyFareRounding(money(26364n, 'SAR'), 'none').amountMinor).toBe(26364n);
    expect(applyFareRounding(money(26364n, 'SAR'), 'nearest_1').amountMinor).toBe(26400n);
    expect(applyFareRounding(money(26364n, 'SAR'), 'nearest_0_5').amountMinor).toBe(26350n);
    expect(applyFareRounding(money(26001n, 'SAR'), 'up_5').amountMinor).toBe(26500n);
  });

  it('collapses the half step for zero decimal currencies', () => {
    expect(applyFareRounding(money(3n, 'JPY'), 'nearest_0_5').amountMinor).toBe(3n);
  });
});

describe('towing worked example (docs/09) reproduced through the helpers', () => {
  it('yields 264.00 SAR total and 304.00 SAR authorized', () => {
    const parts = [
      moneyFromMajor(80, 'SAR'), // base incl 5 km
      moneyFromMajor(68, 'SAR'), // (22 - 5) km x 4
      moneyFromMajor(15, 'SAR'), // 30 min x 0.5
      moneyFromMajor(6, 'SAR'), // (8 - 5) approach km x 2
    ];
    const subtotal = sumMoney(parts, 'SAR');
    expect(subtotal.amountMinor).toBe(16900n);

    const withClass = scaleMoney(subtotal, 1.3); // luxury class multiplier
    const withSurge = scaleMoney(withClass, 1.2); // scheduled surge
    const total = applyFareRounding(withSurge, 'nearest_1');
    expect(total.amountMinor).toBe(26400n); // 264.00 SAR

    const authorized = applyFareRounding(scaleMoney(total, 1.15), 'nearest_1');
    expect(authorized.amountMinor).toBe(30400n); // 304.00 SAR
  });
});

describe('payment split example (docs/06) balances exactly', () => {
  it('provider + platform + gateway fee sum to the payment amount (fee_source = provider, mada)', () => {
    const payment = money(10000n, 'SAR'); // 100.00 SAR
    const platformFee = money(1000n, 'SAR'); // 10.00 SAR
    const gatewayFee = money(98n, 'SAR'); // mada 0.85% + 15% VAT ~= 0.98 SAR
    const providerSplit = subMoney(subMoney(payment, platformFee), gatewayFee);
    expect(providerSplit.amountMinor).toBe(8902n); // 89.02 SAR

    const sum = sumMoney([providerSplit, platformFee, gatewayFee], 'SAR');
    expect(sum.amountMinor).toBe(payment.amountMinor);
  });
});
