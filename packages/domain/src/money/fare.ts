import { minorPerMajor } from './currency.js';
import { type Money, money } from './money.js';
import { roundToStep } from './rounding.js';

/**
 * Fare rounding rules selectable per rate card (docs/09). These operate on the
 * displayed fare in major units, distinct from the internal minor unit rounding
 * used when scaling by a factor.
 */
export type FareRounding = 'none' | 'nearest_0_5' | 'nearest_1' | 'up_5';

/** Applies a rate card fare rounding rule to a non-negative amount. */
export function applyFareRounding(amount: Money, rule: FareRounding): Money {
  if (rule === 'none') {
    return amount;
  }
  const major = minorPerMajor(amount.currency);
  switch (rule) {
    case 'nearest_1':
      return money(roundToStep(amount.amountMinor, major, 'nearest'), amount.currency);
    case 'nearest_0_5': {
      // Half a major unit, e.g. 50 halalas. For zero decimal currencies this
      // collapses to whole units.
      const half = major / 2n;
      const step = half > 0n ? half : major;
      return money(roundToStep(amount.amountMinor, step, 'nearest'), amount.currency);
    }
    case 'up_5':
      return money(roundToStep(amount.amountMinor, major * 5n, 'up'), amount.currency);
  }
}
