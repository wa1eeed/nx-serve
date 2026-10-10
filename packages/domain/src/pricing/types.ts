/**
 * Shared pricing and fee value types (docs/09). Mirror the DB enums and CHECK
 * values (migration 0007). Pure: amounts are integer minor units (bigint), rates
 * are numeric, and every charge is computed in bigint to avoid float drift.
 */
import { minorPerMajor, type CurrencyCode } from '../money/currency.js';
import { scaleMinor } from '../money/rounding.js';

export type FeeCalc = 'percent' | 'fixed' | 'percent_plus_fixed';
export type FeeBearer = 'customer' | 'provider' | 'platform';
export type VatMode = 'exclusive' | 'inclusive' | 'exempt';

/** A conditional charge: a percent of a base, a fixed amount, or both. */
export interface ChargeRule {
  calc: FeeCalc;
  ratePct?: number;
  fixedAmountMinor?: bigint;
}

/** The minor-unit charge for a rate applied to units, for example per_km x km. */
export function rateCharge(currency: CurrencyCode, rate: number, units: number): bigint {
  if (rate <= 0 || units <= 0) return 0n;
  return scaleMinor(minorPerMajor(currency), rate * units, 'half_up');
}

/** Evaluates a charge rule against a base amount in minor units. */
export function applyCharge(rule: ChargeRule, baseMinor: bigint): bigint {
  const pct = rule.ratePct !== undefined ? scaleMinor(baseMinor, rule.ratePct / 100, 'half_up') : 0n;
  const fixed = rule.fixedAmountMinor ?? 0n;
  switch (rule.calc) {
    case 'percent':
      return pct;
    case 'fixed':
      return fixed;
    case 'percent_plus_fixed':
      return pct + fixed;
  }
}

/** Clamps a minor amount to an optional min and max (min applied first). */
export function clampMinor(amountMinor: bigint, minMinor?: bigint | null, maxMinor?: bigint | null): bigint {
  let v = amountMinor;
  if (minMinor !== undefined && minMinor !== null && v < minMinor) v = minMinor;
  if (maxMinor !== undefined && maxMinor !== null && v > maxMinor) v = maxMinor;
  return v;
}
