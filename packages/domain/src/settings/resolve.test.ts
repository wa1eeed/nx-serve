import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { resolveSetting } from './resolve.js';

describe('resolveSetting', () => {
  it('returns the default when no level sets a value', () => {
    expect(resolveSetting({ defaultValue: 30 }, [])).toBe(30);
  });

  it('lets a lower level override an upper level', () => {
    const value = resolveSetting({ defaultValue: 30 }, [
      { level: 'platform', value: 30 },
      { level: 'tenant', value: 20 },
    ]);
    expect(value).toBe(20);
  });

  it('respects a lock set by an upper level', () => {
    const value = resolveSetting({ defaultValue: 30 }, [
      { level: 'platform', value: 45, locked: true },
      { level: 'tenant', value: 20 },
    ]);
    expect(value).toBe(45);
  });

  it('clamps a lower-level value to upper-level bounds', () => {
    const value = resolveSetting({ defaultValue: 10 }, [
      { level: 'platform', max: 15 },
      { level: 'tenant', value: 100 },
    ]);
    expect(value).toBe(15);
  });

  it('tightens bounds across multiple levels', () => {
    const levels = [
      { level: 'platform' as const, min: 10, max: 90 },
      { level: 'tenant_group' as const, min: 20, max: 80 },
    ];
    expect(resolveSetting({ defaultValue: 0 }, [...levels, { level: 'provider', value: 100 }])).toBe(80);
    expect(resolveSetting({ defaultValue: 0 }, [...levels, { level: 'provider', value: 5 }])).toBe(20);
  });

  it('passes non-numeric values through unchanged', () => {
    expect(resolveSetting({ defaultValue: false }, [{ level: 'tenant', value: true }])).toBe(true);
  });

  it('always stays within bounds when numeric (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: -50, max: 150 }),
        (a, b, chosen) => {
          const min = Math.min(a, b);
          const max = Math.max(a, b);
          const value = resolveSetting({ defaultValue: 0 }, [
            { level: 'platform', min, max },
            { level: 'tenant', value: chosen },
          ]) as number;
          expect(value).toBeGreaterThanOrEqual(min);
          expect(value).toBeLessThanOrEqual(max);
        },
      ),
    );
  });
});
