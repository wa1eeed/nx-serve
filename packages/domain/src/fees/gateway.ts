/**
 * Gateway fee estimator (docs/09 section 7). Mirrors the gateway fee matrix per
 * merchant to estimate margins before the card type is known. The real fee from
 * the payment response is stored after payment. Pure, bigint minor units.
 */
import { scaleMinor } from '../money/rounding.js';
import { clampMinor } from '../pricing/types.js';

export interface GatewayFeeRate {
  /** Percent of the amount, for example mada 0.85. */
  ratePct: number;
  fixedAmountMinor: bigint;
  /** Fee cap, for example the mada 200 SAR cap. */
  capAmountMinor?: bigint | null;
  vatPct: number;
}

/** The gateway fee for an amount: (pct + fixed), capped, plus VAT. */
export function estimateGatewayFee(rate: GatewayFeeRate, amountMinor: bigint): bigint {
  if (amountMinor <= 0n) return 0n;
  const beforeCap = scaleMinor(amountMinor, rate.ratePct / 100, 'half_up') + rate.fixedAmountMinor;
  const capped = clampMinor(beforeCap, undefined, rate.capAmountMinor);
  const vat = scaleMinor(capped, rate.vatPct / 100, 'half_up');
  return capped + vat;
}
