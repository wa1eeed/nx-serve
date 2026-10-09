import { describe, expect, it } from 'vitest';
import { divideRounded, roundToStep, scaleMinor } from './rounding.js';

describe('divideRounded', () => {
  it('throws on zero denominator', () => {
    expect(() => divideRounded(10n, 0n, 'half_up')).toThrow(RangeError);
  });

  it('returns the exact quotient when divisible', () => {
    expect(divideRounded(10n, 2n, 'half_up')).toBe(5n);
    expect(divideRounded(-10n, 2n, 'half_even')).toBe(-5n);
  });

  it('normalises a negative denominator', () => {
    expect(divideRounded(10n, -4n, 'half_up')).toBe(-3n);
  });

  it('floor and ceil respect sign', () => {
    expect(divideRounded(7n, 2n, 'floor')).toBe(3n);
    expect(divideRounded(-7n, 2n, 'floor')).toBe(-4n);
    expect(divideRounded(7n, 2n, 'ceil')).toBe(4n);
    expect(divideRounded(-7n, 2n, 'ceil')).toBe(-3n);
  });

  it('up rounds away from zero, down toward zero', () => {
    expect(divideRounded(7n, 2n, 'up')).toBe(4n);
    expect(divideRounded(-7n, 2n, 'up')).toBe(-4n);
    expect(divideRounded(7n, 2n, 'down')).toBe(3n);
    expect(divideRounded(-7n, 2n, 'down')).toBe(-3n);
  });

  it('half_up rounds halves away from zero', () => {
    expect(divideRounded(5n, 2n, 'half_up')).toBe(3n);
    expect(divideRounded(-5n, 2n, 'half_up')).toBe(-3n);
    expect(divideRounded(4n, 3n, 'half_up')).toBe(1n);
  });

  it('half_even rounds halves to the even neighbour', () => {
    expect(divideRounded(5n, 2n, 'half_even')).toBe(2n);
    expect(divideRounded(7n, 2n, 'half_even')).toBe(4n);
    expect(divideRounded(-5n, 2n, 'half_even')).toBe(-2n);
    // Not exactly half: falls through the > and < branches.
    expect(divideRounded(8n, 3n, 'half_even')).toBe(3n);
    expect(divideRounded(7n, 3n, 'half_even')).toBe(2n);
  });
});

describe('scaleMinor', () => {
  it('throws on a non-finite factor', () => {
    expect(() => scaleMinor(100n, Number.POSITIVE_INFINITY, 'half_up')).toThrow(RangeError);
  });

  it('scales by a multiplier without drift', () => {
    expect(scaleMinor(16900n, 1.3, 'half_up')).toBe(21970n);
    expect(scaleMinor(21970n, 1.2, 'half_up')).toBe(26364n);
    expect(scaleMinor(26400n, 1.15, 'half_up')).toBe(30360n);
  });
});

describe('roundToStep', () => {
  it('throws on a non-positive step', () => {
    expect(() => roundToStep(100n, 0n, 'nearest')).toThrow(RangeError);
  });

  it('throws on a negative amount', () => {
    expect(() => roundToStep(-1n, 100n, 'nearest')).toThrow(RangeError);
  });

  it('rounds to the nearest step', () => {
    expect(roundToStep(26364n, 100n, 'nearest')).toBe(26400n);
    expect(roundToStep(26349n, 100n, 'nearest')).toBe(26300n);
  });

  it('rounds up to the next step', () => {
    expect(roundToStep(26001n, 500n, 'up')).toBe(26500n);
    expect(roundToStep(26500n, 500n, 'up')).toBe(26500n);
  });
});
