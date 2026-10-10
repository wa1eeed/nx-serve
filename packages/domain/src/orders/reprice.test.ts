import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { deviationPct, reprice } from './reprice.js';

describe('reprice (docs/07 section 5)', () => {
  const baseInput = {
    metered: false,
    estimated: { distanceKm: 20, durationMin: 30 },
    repriceThresholdPct: 20,
    estimatedTotalMinor: 26400n,
    authorizedMinor: 30400n, // estimate + 15% buffer, rounded
  };

  it('keeps the estimate when the actual trip is within the threshold', () => {
    const r = reprice({ ...baseInput, actual: { distanceKm: 22, durationMin: 33 }, actualTotalMinor: 29000n });
    expect(r.repriced).toBe(false); // 10% deviation < 20%
    expect(r.finalTotalMinor).toBe(26400n);
    expect(r.captureMinor).toBe(26400n);
    expect(r.needsSupplement).toBe(false);
  });

  it('reprices from the actual trip when the deviation exceeds the threshold', () => {
    const r = reprice({ ...baseInput, actual: { distanceKm: 30, durationMin: 45 }, actualTotalMinor: 29000n });
    expect(r.repriced).toBe(true); // 50% deviation
    expect(r.finalTotalMinor).toBe(29000n);
    expect(r.captureMinor).toBe(29000n);
  });

  it('always reprices a metered tier', () => {
    const r = reprice({ ...baseInput, metered: true, actual: { distanceKm: 21, durationMin: 31 }, actualTotalMinor: 27000n });
    expect(r.repriced).toBe(true);
    expect(r.finalTotalMinor).toBe(27000n);
  });

  it('clamps the capture to the authorization and reports the supplement', () => {
    const r = reprice({ ...baseInput, actual: { distanceKm: 40, durationMin: 60 }, actualTotalMinor: 35000n });
    expect(r.finalTotalMinor).toBe(35000n);
    expect(r.captureMinor).toBe(30400n); // clamped to authorized
    expect(r.needsSupplement).toBe(true);
    expect(r.supplementMinor).toBe(4600n); // 35000 - 30400
  });

  it('handles a zero estimated dimension', () => {
    expect(deviationPct({ distanceKm: 0, durationMin: 0 }, { distanceKm: 0, durationMin: 0 })).toBe(0);
    expect(deviationPct({ distanceKm: 0, durationMin: 0 }, { distanceKm: 5, durationMin: 0 })).toBe(Infinity);
  });
});

describe('property: capture never exceeds the authorization and supplement closes the gap', () => {
  it('holds for all actual totals', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 100000n }),
        fc.bigInt({ min: 0n, max: 100000n }),
        fc.bigInt({ min: 0n, max: 100000n }),
        fc.boolean(),
        (estTotal, actTotal, authorized, metered) => {
          const r = reprice({
            metered,
            estimated: { distanceKm: 20, durationMin: 30 },
            actual: { distanceKm: 40, durationMin: 60 },
            repriceThresholdPct: 20,
            estimatedTotalMinor: estTotal,
            actualTotalMinor: actTotal,
            authorizedMinor: authorized,
          });
          const final = r.finalTotalMinor;
          return (
            r.captureMinor <= authorized &&
            r.captureMinor === (final < authorized ? final : authorized) &&
            r.captureMinor + r.supplementMinor === final
          );
        },
      ),
    );
  });
});
