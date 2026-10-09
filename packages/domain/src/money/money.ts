import { CurrencyMismatchError, MoneyInvariantError } from '../errors.js';
import { type CurrencyCode, currencyExponent, minorPerMajor } from './currency.js';
import { type RoundingMode, scaleMinor } from './rounding.js';

/**
 * A monetary amount as integer minor units plus an ISO 4217 currency.
 * This is the only representation of money in code, the database and the API.
 */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

/** Constructs a Money value from integer minor units. */
export function money(amountMinor: bigint, currency: CurrencyCode): Money {
  // Validates the currency eagerly.
  currencyExponent(currency);
  return { amountMinor, currency: currency.toUpperCase() };
}

/** A zero amount in the given currency. */
export function zeroMoney(currency: CurrencyCode): Money {
  return money(0n, currency);
}

/**
 * Builds a Money value from a major unit number (e.g. 264 SAR), rounding to
 * minor units. Intended for seeds, tests and fixtures, not hot pricing paths.
 */
export function moneyFromMajor(
  major: number,
  currency: CurrencyCode,
  mode: RoundingMode = 'half_up',
): Money {
  const factorMinor = minorPerMajor(currency);
  return money(scaleMinor(factorMinor, major, mode), currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function negateMoney(a: Money): Money {
  return money(-a.amountMinor, a.currency);
}

/** -1, 0 or 1. Throws on currency mismatch. */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

export function isZeroMoney(a: Money): boolean {
  return a.amountMinor === 0n;
}

export function isNegativeMoney(a: Money): boolean {
  return a.amountMinor < 0n;
}

/**
 * Sums a list of Money values. The currency is required so an empty list still
 * yields a well defined zero, and every element must match it.
 */
export function sumMoney(items: readonly Money[], currency: CurrencyCode): Money {
  let total = 0n;
  const normalised = currency.toUpperCase();
  for (const item of items) {
    if (item.currency !== normalised) {
      throw new CurrencyMismatchError(normalised, item.currency);
    }
    total += item.amountMinor;
  }
  return money(total, currency);
}

/** Scales an amount by a fractional factor (multiplier, surge, VAT) with rounding. */
export function scaleMoney(a: Money, factor: number, mode: RoundingMode = 'half_up'): Money {
  return money(scaleMinor(a.amountMinor, factor, mode), a.currency);
}

/**
 * Splits `total` into parts proportional to `weights`, guaranteeing the parts
 * sum back exactly to `total` (largest remainder method). This is the core
 * invariant behind payment splits: sum(splits) == amount, always.
 *
 * Weights must be non-negative and not all zero. The total must be non-negative.
 */
export function allocateMoney(total: Money, weights: readonly bigint[]): Money[] {
  if (weights.length === 0) {
    throw new MoneyInvariantError('allocateMoney requires at least one weight');
  }
  if (total.amountMinor < 0n) {
    throw new MoneyInvariantError('allocateMoney expects a non-negative total');
  }
  let weightSum = 0n;
  for (const w of weights) {
    if (w < 0n) {
      throw new MoneyInvariantError('weights must be non-negative');
    }
    weightSum += w;
  }
  if (weightSum === 0n) {
    throw new MoneyInvariantError('weights must not all be zero');
  }

  const bases: bigint[] = [];
  const remainders: { index: number; remainder: bigint }[] = [];
  let allocated = 0n;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] as bigint;
    const product = total.amountMinor * w;
    const base = product / weightSum;
    bases.push(base);
    remainders.push({ index: i, remainder: product % weightSum });
    allocated += base;
  }

  let leftover = total.amountMinor - allocated;
  // Distribute the leftover minor units to the largest remainders first, then by
  // original order, so the allocation is deterministic.
  remainders.sort((a, b) => {
    if (a.remainder > b.remainder) return -1;
    if (a.remainder < b.remainder) return 1;
    return a.index - b.index;
  });
  let cursor = 0;
  while (leftover > 0n) {
    const target = remainders[cursor % remainders.length] as { index: number; remainder: bigint };
    bases[target.index] = (bases[target.index] as bigint) + 1n;
    leftover -= 1n;
    cursor += 1;
  }

  return bases.map((amountMinor) => money(amountMinor, total.currency));
}
