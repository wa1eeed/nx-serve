/**
 * Payment split allocator (docs/06 sections 3 and 4). Pure: from the payment
 * amount, the provider service amount and the fee breakdown, produce the splits
 * sent to the gateway (which always sum to the payment amount, with zero or one
 * fee source), and the net settlement after the gateway fee.
 *
 * The gateway fee is the gateway's own deduction from the fee-source split, not a
 * split line, so the split array sums to the payment while the settlement view
 * shows the net. Whether splits are set at authorize or capture (Q3) and the
 * aggregation model (Q1) are open; this computes the amounts, which the invariant
 * `assertSplitsBalance` (integrations) guards wherever they are sent.
 */
import { type CurrencyCode } from '../money/currency.js';

export type SplitFeeSource = 'provider' | 'platform';
export type SplitRecipientType = 'provider' | 'platform' | 'beneficiary';

export interface SplitLine {
  recipientType: SplitRecipientType;
  recipientRef: string;
  amountMinor: bigint;
  isFeeSource: boolean;
  refundable: boolean;
}

export interface AllocateSplitsInput {
  currency: CurrencyCode;
  /** The amount the customer pays and the payment is authorized or captured for. */
  paymentAmountMinor: bigint;
  /** The provider's service earnings before provider-borne fees. */
  serviceAmountMinor: bigint;
  /** Provider-borne fees deducted from the provider and paid to the platform. */
  providerDeductionMinor: bigint;
  providerRef: string;
  platformRef: string;
  /** Which split the gateway deducts its fee from. */
  feeSource: SplitFeeSource;
  providerRefundable?: boolean;
  platformRefundable?: boolean;
}

export interface Settlement {
  providerNetMinor: bigint;
  platformNetMinor: bigint;
  gatewayFeeMinor: bigint;
}

/** The splits sent to the gateway. They always sum to the payment amount. */
export function allocateSplits(input: AllocateSplitsInput): SplitLine[] {
  const providerAmount = input.serviceAmountMinor - input.providerDeductionMinor;
  const platformAmount = input.paymentAmountMinor - providerAmount;
  return [
    {
      recipientType: 'provider',
      recipientRef: input.providerRef,
      amountMinor: providerAmount,
      isFeeSource: input.feeSource === 'provider',
      refundable: input.providerRefundable ?? true,
    },
    {
      recipientType: 'platform',
      recipientRef: input.platformRef,
      amountMinor: platformAmount,
      isFeeSource: input.feeSource === 'platform',
      refundable: input.platformRefundable ?? true,
    },
  ];
}

/** The net each party receives after the gateway deducts its fee from the fee source. */
export function settle(
  splits: readonly SplitLine[],
  gatewayFeeMinor: bigint,
  feeSource: SplitFeeSource,
  platformBorneFeesMinor = 0n,
): Settlement {
  const provider = splits.find((s) => s.recipientType === 'provider')?.amountMinor ?? 0n;
  const platform = splits.find((s) => s.recipientType === 'platform')?.amountMinor ?? 0n;
  return {
    providerNetMinor: provider - (feeSource === 'provider' ? gatewayFeeMinor : 0n),
    platformNetMinor: platform - platformBorneFeesMinor - (feeSource === 'platform' ? gatewayFeeMinor : 0n),
    gatewayFeeMinor,
  };
}

/** The sum of split amounts; equals the payment amount for a balanced set. */
export function splitsSum(splits: readonly SplitLine[]): bigint {
  return splits.reduce((acc, s) => acc + s.amountMinor, 0n);
}
