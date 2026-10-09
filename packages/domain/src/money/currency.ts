import { UnknownCurrencyError } from '../errors.js';

/** ISO 4217 alpha-3 currency code, uppercase. */
export type CurrencyCode = string;

/**
 * ISO 4217 minor unit exponents for the currencies we support today.
 * SAR is 2 (halalas), matching Moyasar. Several Gulf currencies use 3 decimals.
 * Adding a currency means adding one row here; no schema or engine change.
 */
const EXPONENTS: Readonly<Record<string, number>> = Object.freeze({
  SAR: 2,
  AED: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  EGP: 2,
  QAR: 2,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
  JPY: 0,
});

/** Returns the ISO 4217 minor unit exponent for a currency, or throws if unknown. */
export function currencyExponent(currency: CurrencyCode): number {
  const exponent = EXPONENTS[currency.toUpperCase()];
  if (exponent === undefined) {
    throw new UnknownCurrencyError(currency);
  }
  return exponent;
}

/** Returns true when the currency is supported. */
export function isSupportedCurrency(currency: CurrencyCode): boolean {
  return Object.prototype.hasOwnProperty.call(EXPONENTS, currency.toUpperCase());
}

/** Number of minor units in one major unit, e.g. 100n for SAR, 1000n for KWD. */
export function minorPerMajor(currency: CurrencyCode): bigint {
  return 10n ** BigInt(currencyExponent(currency));
}
