/** Typed domain errors. These map to problem+json codes at the API boundary. */

export class DomainError extends Error {
  /** Stable machine readable code, mapped to problem+json `code`. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class UnknownCurrencyError extends DomainError {
  constructor(currency: string) {
    super('unknown_currency', `Unknown or unsupported ISO 4217 currency: ${currency}`);
  }
}

export class CurrencyMismatchError extends DomainError {
  constructor(a: string, b: string) {
    super('currency_mismatch', `Cannot combine amounts in ${a} and ${b}`);
  }
}

export class MoneyInvariantError extends DomainError {
  constructor(message: string) {
    super('money_invariant', message);
  }
}
