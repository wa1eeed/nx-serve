/**
 * Rounding helpers over integer minor units. All money arithmetic stays in
 * `bigint` minor units; only scaling by a fractional factor (class multiplier,
 * surge, VAT) needs an explicit, documented rounding rule.
 */

export type RoundingMode = 'half_up' | 'half_even' | 'up' | 'down' | 'ceil' | 'floor';

/**
 * Multiplies an integer minor amount by a non-negative rational factor expressed
 * as a floating number and rounds back to an integer minor amount.
 *
 * To avoid floating point drift the factor is converted to a rational
 * numerator/denominator and the whole computation is done in bigint. The factor
 * is captured at a fixed scale of 1e9, which is ample for percentages, per unit
 * rates and multipliers used in pricing.
 */
export function scaleMinor(amountMinor: bigint, factor: number, mode: RoundingMode): bigint {
  if (!Number.isFinite(factor)) {
    throw new RangeError('factor must be a finite number');
  }
  const SCALE = 1_000_000_000n;
  const numerator = amountMinor * BigInt(Math.round(factor * 1_000_000_000));
  return divideRounded(numerator, SCALE, mode);
}

/** Integer division of `numerator / denominator` with the given rounding mode. */
export function divideRounded(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  if (denominator === 0n) {
    throw new RangeError('denominator must not be zero');
  }
  // Normalise so the denominator is positive; fold its sign into the numerator.
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const q = n / d;
  const r = n % d;
  if (r === 0n) {
    return q;
  }
  const negative = n < 0n;
  const twiceRemainder = 2n * (r < 0n ? -r : r);
  const absQ = q < 0n ? -q : q;

  let roundAwayFromZero: boolean;
  switch (mode) {
    case 'floor':
      return negative ? q - 1n : q;
    case 'ceil':
      return negative ? q : q + 1n;
    case 'down':
      roundAwayFromZero = false;
      break;
    case 'up':
      roundAwayFromZero = true;
      break;
    case 'half_up':
      roundAwayFromZero = twiceRemainder >= d;
      break;
    case 'half_even': {
      if (twiceRemainder > d) {
        roundAwayFromZero = true;
      } else if (twiceRemainder < d) {
        roundAwayFromZero = false;
      } else {
        roundAwayFromZero = absQ % 2n === 1n;
      }
      break;
    }
  }

  if (!roundAwayFromZero) {
    return q;
  }
  return negative ? q - 1n : q + 1n;
}

/**
 * Rounds a non-negative minor amount to the nearest multiple of `step` (or up to
 * the next multiple when `direction` is 'up'). Used by fare rounding rules.
 */
export function roundToStep(
  amountMinor: bigint,
  step: bigint,
  direction: 'nearest' | 'up',
): bigint {
  if (step <= 0n) {
    throw new RangeError('step must be positive');
  }
  if (amountMinor < 0n) {
    throw new RangeError('roundToStep expects a non-negative amount');
  }
  if (direction === 'up') {
    return ((amountMinor + step - 1n) / step) * step;
  }
  return ((amountMinor + step / 2n) / step) * step;
}
