/**
 * Cancellation outcome (docs/07 section 6). Pure: given the moment a cancellation
 * happens and the rate card policy, decide whether to void (reverse all splits),
 * partially capture a fee, or do nothing, and the amount. A void always reverses
 * the splits (CLAUDE.md 2.3); a cancellation fee is taken by partial capture, never
 * by over-capturing. The caller supplies the authorized amount so a fee can never
 * exceed what was authorized.
 */

import { DomainError } from '../errors.js';

export type CancellationMoment =
  | 'before_assignment'
  | 'within_free'
  | 'after_free'
  | 'after_arrival'
  | 'provider_cancel';

export type CancellationAction = 'none' | 'void' | 'partial_capture';

export interface CancellationPolicy {
  cancellationFeeMinor: bigint;
  minimumFareMinor: bigint;
  /** The amount authorized on the order; a fee is clamped to this. Omit if nothing authorized. */
  authorizedMinor?: bigint;
}

export interface CancellationOutcome {
  action: CancellationAction;
  /** The amount captured from the customer (0 for none and void). */
  chargeMinor: bigint;
  /** Re-dispatch the order (a provider cancellation). */
  reDispatch: boolean;
  /** The customer caused the cancellation (informational, for reliability scoring). */
  customerFault: boolean;
}

const maxBig = (a: bigint, b: bigint): bigint => (a > b ? a : b);
const minBig = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/** A fee, clamped to the authorized amount. A non-zero fee requires a known
 * authorization ceiling; a zero fee voids a held authorization, or is a no-op. */
function feeOutcome(feeMinor: bigint, policy: CancellationPolicy): CancellationOutcome {
  const fee = feeMinor < 0n ? 0n : feeMinor;
  // Never produce a partial capture without a ceiling: it could exceed what was
  // authorized (CLAUDE.md 2.3, docs/06: capture never exceeds the authorization).
  if (fee > 0n && policy.authorizedMinor === undefined) {
    throw new DomainError('authorization_required', 'A cancellation fee needs the authorized amount to clamp to');
  }
  const charge = policy.authorizedMinor !== undefined ? minBig(fee, policy.authorizedMinor) : 0n;
  if (charge === 0n) {
    // Void a real held authorization; nothing to do if none was authorized.
    const action: CancellationAction = policy.authorizedMinor !== undefined && policy.authorizedMinor > 0n ? 'void' : 'none';
    return { action, chargeMinor: 0n, reDispatch: false, customerFault: true };
  }
  return { action: 'partial_capture', chargeMinor: charge, reDispatch: false, customerFault: true };
}

export function resolveCancellation(moment: CancellationMoment, policy: CancellationPolicy): CancellationOutcome {
  switch (moment) {
    case 'before_assignment':
      // Nothing authorized yet, so nothing to void or capture.
      return { action: 'none', chargeMinor: 0n, reDispatch: false, customerFault: true };
    case 'within_free':
      // Free cancellation after assignment: void reverses the authorization and splits.
      return { action: 'void', chargeMinor: 0n, reDispatch: false, customerFault: true };
    case 'after_free':
      return feeOutcome(policy.cancellationFeeMinor, policy);
    case 'after_arrival':
      // Higher fee or the minimum fare, whichever is greater.
      return feeOutcome(maxBig(policy.cancellationFeeMinor, policy.minimumFareMinor), policy);
    case 'provider_cancel':
      // No charge to the customer; re-dispatch and penalize the provider elsewhere.
      return { action: 'void', chargeMinor: 0n, reDispatch: true, customerFault: false };
  }
}
