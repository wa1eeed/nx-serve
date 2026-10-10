/**
 * Estimate composer (docs/09 section 3 steps 9 to 10): the service fare plus the
 * customer-borne fees give the customer total, then the authorization buffer gives
 * the amount to authorize. Provider-borne fees (for example the platform
 * commission) do not change the customer total; they are settled from the splits.
 * Pure.
 */
import { type CurrencyCode } from '../money/currency.js';
import { money } from '../money/money.js';
import { applyFees, type FeeComponent, type FeeLine } from '../fees/engine.js';
import { authorizedAmount, computeFare, type FareInput, type FareLine } from './fare.js';

export interface EstimateInput extends FareInput {
  feeComponents?: FeeComponent[];
  authBufferPct: number;
  vatPct?: number;
}

export interface Estimate {
  currency: CurrencyCode;
  fareLines: FareLine[];
  feeLines: FeeLine[];
  serviceFareMinor: bigint;
  customerChargeMinor: bigint;
  /** What the customer pays: service fare plus customer-borne fees. */
  customerTotalMinor: bigint;
  /** The amount to authorize: customer total times (1 + buffer), rounded. */
  authorizedMinor: bigint;
  /** Deducted from the provider settlement (provider-borne fees). */
  providerDeductionMinor: bigint;
  platformFeeMinor: bigint;
  vatMinor: bigint;
}

export function estimate(input: EstimateInput): Estimate {
  const currency = input.rateCard.currency;
  const addons = input.addonsMinor ?? 0n;
  const fare = computeFare(input);
  // The fare includes add-ons (fare step 7); the fee engine expects a service-only
  // base so service_amount, addons and order_total each count once. The customer
  // total is still the add-on-inclusive fare plus customer-borne fees.
  const fees = applyFees({
    currency,
    serviceAmountMinor: fare.serviceFareMinor - addons,
    addonsMinor: addons,
    components: input.feeComponents ?? [],
    ...(input.vatPct !== undefined ? { vatPct: input.vatPct } : {}),
  });

  const customerTotalMinor = fare.serviceFareMinor + fees.customerChargeMinor;
  const authorizedMinor = authorizedAmount(money(customerTotalMinor, currency), input.authBufferPct, input.rateCard.rounding).amountMinor;

  return {
    currency,
    fareLines: fare.lines,
    feeLines: fees.lines,
    serviceFareMinor: fare.serviceFareMinor,
    customerChargeMinor: fees.customerChargeMinor,
    customerTotalMinor,
    authorizedMinor,
    providerDeductionMinor: fees.providerDeductionMinor,
    platformFeeMinor: fees.platformFeeMinor,
    vatMinor: fees.vatMinor,
  };
}
