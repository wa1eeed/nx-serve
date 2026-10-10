import { describe, expect, it } from 'vitest';
import { combineSurge } from './surge.js';

describe('combineSurge', () => {
  it('is 1 with no surge and needs no acknowledgement', () => {
    const r = combineSurge({});
    expect(r.multiplier).toBe(1);
    expect(r.requiresAck).toBe(false);
  });

  it('takes the highest matching scheduled multiplier', () => {
    expect(combineSurge({ scheduled: [1.2, 1.5, 1.1] }).multiplier).toBe(1.5);
  });

  it('computes a dynamic multiplier from the demand-to-supply ratio', () => {
    const steps = [
      { threshold: 1.5, multiplier: 1.3 },
      { threshold: 2, multiplier: 1.6 },
    ];
    expect(combineSurge({ dynamic: { demand: 20, supply: 10, steps, maxMultiplier: 2 } }).multiplier).toBe(1.6);
    expect(combineSurge({ dynamic: { demand: 16, supply: 10, steps, maxMultiplier: 2 } }).multiplier).toBe(1.3);
    expect(combineSurge({ dynamic: { demand: 5, supply: 10, steps, maxMultiplier: 2 } }).multiplier).toBe(1);
  });

  it('caps the dynamic multiplier', () => {
    const steps = [{ threshold: 1, multiplier: 5 }];
    expect(combineSurge({ dynamic: { demand: 10, supply: 1, steps, maxMultiplier: 2 } }).multiplier).toBe(2);
  });

  it('combines scheduled and dynamic by max or multiply', () => {
    const steps = [{ threshold: 1, multiplier: 1.5 }];
    const dyn = { demand: 10, supply: 5, steps, maxMultiplier: 3 };
    expect(combineSurge({ scheduled: [1.2], dynamic: dyn, combine: 'max' }).multiplier).toBe(1.5);
    expect(combineSurge({ scheduled: [1.2], dynamic: dyn, combine: 'multiply' }).multiplier).toBeCloseTo(1.8, 5);
  });

  it('requires acknowledgement when surge is above 1', () => {
    expect(combineSurge({ scheduled: [1.3] }).requiresAck).toBe(true);
  });
});
