/**
 * Fee engine (docs/09 section 6). Pure: apply a fee schedule's components to a
 * service amount to produce the fee lines per bearer and the amounts that flow to
 * the customer total, the provider deduction and the platform take. VAT follows
 * each component's mode (exclusive, inclusive, exempt). The no-surcharging rule (a
 * customer-borne fee is identical across payment methods) is enforced upstream by
 * the DB CHECK and the contracts; this engine computes the money.
 */
import { type CurrencyCode } from '../money/currency.js';
import { scaleMinor } from '../money/rounding.js';
import { applyCharge, clampMinor, type FeeBearer, type FeeCalc, type VatMode } from '../pricing/types.js';

export const DEFAULT_VAT_PCT = 15;

export interface FeeComponent {
  code: string;
  bearer: FeeBearer;
  calc: FeeCalc;
  ratePct?: number;
  fixedAmountMinor?: bigint;
  minAmountMinor?: bigint | null;
  maxAmountMinor?: bigint | null;
  base: 'service_amount' | 'addons' | 'order_total';
  vatMode: VatMode;
  vatPct?: number;
  refundable?: boolean;
}

export interface FeeInput {
  currency: CurrencyCode;
  serviceAmountMinor: bigint;
  addonsMinor?: bigint;
  components: FeeComponent[];
  vatPct?: number;
}

export interface FeeLine {
  code: string;
  bearer: FeeBearer;
  /** The fee amount: VAT-inclusive when vatMode is inclusive, otherwise net of VAT. */
  amountMinor: bigint;
  vatMinor: bigint;
  vatMode: VatMode;
  refundable: boolean;
}

export interface FeeResult {
  lines: FeeLine[];
  /** Added to what the customer pays (customer-borne fees plus their exclusive VAT). */
  customerChargeMinor: bigint;
  /** Deducted from the provider settlement (provider-borne fees). */
  providerDeductionMinor: bigint;
  /** Fees the platform itself bears (reduce the platform net). */
  platformFeeMinor: bigint;
  /** Total VAT across all fee lines (for reporting). */
  vatMinor: bigint;
}

function baseAmount(c: FeeComponent, input: FeeInput): bigint {
  const addons = input.addonsMinor ?? 0n;
  if (c.base === 'addons') return addons;
  if (c.base === 'order_total') return input.serviceAmountMinor + addons;
  return input.serviceAmountMinor;
}

export function applyFees(input: FeeInput): FeeResult {
  const defVat = input.vatPct ?? DEFAULT_VAT_PCT;
  const lines: FeeLine[] = [];
  let customerCharge = 0n;
  let providerDeduction = 0n;
  let platformFee = 0n;
  let vatTotal = 0n;

  for (const c of input.components) {
    const vatPct = c.vatPct ?? defVat;
    const rule = {
      calc: c.calc as FeeCalc,
      ...(c.ratePct !== undefined ? { ratePct: c.ratePct } : {}),
      ...(c.fixedAmountMinor !== undefined ? { fixedAmountMinor: c.fixedAmountMinor } : {}),
    };
    const fee = clampMinor(applyCharge(rule, baseAmount(c, input)), c.minAmountMinor, c.maxAmountMinor);

    let vat = 0n;
    let borne = fee; // amount the bearer actually pays
    if (c.vatMode === 'exclusive') {
      vat = scaleMinor(fee, vatPct / 100, 'half_up');
      borne = fee + vat;
    } else if (c.vatMode === 'inclusive') {
      vat = scaleMinor(fee, vatPct / (100 + vatPct), 'half_up');
      borne = fee;
    }
    vatTotal += vat;
    lines.push({ code: c.code, bearer: c.bearer, amountMinor: fee, vatMinor: vat, vatMode: c.vatMode, refundable: c.refundable ?? true });

    if (c.bearer === 'customer') customerCharge += borne;
    else if (c.bearer === 'provider') providerDeduction += borne;
    else platformFee += borne;
  }

  return { lines, customerChargeMinor: customerCharge, providerDeductionMinor: providerDeduction, platformFeeMinor: platformFee, vatMinor: vatTotal };
}
