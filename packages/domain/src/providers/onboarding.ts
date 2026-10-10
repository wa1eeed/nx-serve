/**
 * Onboarding readiness resolver (docs/08 section 2). Pure: from the identity,
 * merchant, document and offering state, derive the provider's onboarding step
 * statuses, overall state, whether it is eligible to be dispatched, and the
 * blockers. "Active when both approvals exist" (merchant active and a category
 * offering approved), with documents satisfied and identity verified.
 */
import { type IdentityStatus, type MerchantStatus, type OfferingStatus, isMerchantOperational } from './common.js';

export type StepStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export type OnboardingState =
  | 'draft'
  | 'verifying'
  | 'documents_pending'
  | 'under_review'
  | 'needs_info'
  | 'active'
  | 'suspended'
  | 'rejected';

export interface OnboardingInput {
  orgActive: boolean;
  identity: IdentityStatus;
  merchant: MerchantStatus;
  documents: { allRequiredSatisfied: boolean; anyPending: boolean; anyBlocking: boolean };
  offerings: { status: OfferingStatus }[];
}

export interface OnboardingResult {
  state: OnboardingState;
  steps: { identity: StepStatus; merchant: StepStatus; documents: StepStatus; approval: StepStatus };
  eligibleForDispatch: boolean;
  blockers: string[];
}

function identityStep(status: IdentityStatus): StepStatus {
  if (status === 'verified') return 'done';
  if (status === 'rejected') return 'blocked';
  return 'in_progress';
}

function merchantStep(status: MerchantStatus): StepStatus {
  if (isMerchantOperational(status)) return 'done';
  if (status === 'draft') return 'pending';
  if (status === 'hold' || status === 'rejected' || status === 'disabled') return 'blocked';
  return 'in_progress'; // submitted, pending, missing_docs
}

function documentsStep(docs: OnboardingInput['documents']): StepStatus {
  if (docs.allRequiredSatisfied) return 'done';
  if (docs.anyBlocking) return 'blocked';
  if (docs.anyPending) return 'in_progress';
  return 'pending';
}

function approvalStep(offerings: { status: OfferingStatus }[]): StepStatus {
  if (offerings.some((o) => o.status === 'approved')) return 'done';
  if (offerings.some((o) => o.status === 'needs_info' || o.status === 'suspended' || o.status === 'rejected')) {
    return 'blocked';
  }
  if (offerings.some((o) => o.status === 'applied' || o.status === 'under_review')) return 'in_progress';
  return 'pending';
}

export function resolveOnboarding(input: OnboardingInput): OnboardingResult {
  const steps = {
    identity: identityStep(input.identity),
    merchant: merchantStep(input.merchant),
    documents: documentsStep(input.documents),
    approval: approvalStep(input.offerings),
  };

  const hasApprovedOffering = input.offerings.some((o) => o.status === 'approved');
  const eligibleForDispatch =
    input.orgActive &&
    input.identity === 'verified' &&
    isMerchantOperational(input.merchant) &&
    input.documents.allRequiredSatisfied &&
    hasApprovedOffering;

  const blockers: string[] = [];
  if (!input.orgActive) blockers.push('org_inactive');
  if (input.identity !== 'verified') blockers.push('identity_not_verified');
  if (!isMerchantOperational(input.merchant)) blockers.push('merchant_not_active');
  if (!input.documents.allRequiredSatisfied) blockers.push('documents_incomplete');
  if (!hasApprovedOffering) blockers.push('no_approved_offering');

  const state = resolveState(input, eligibleForDispatch);
  return { state, steps, eligibleForDispatch, blockers };
}

function resolveState(input: OnboardingInput, eligible: boolean): OnboardingState {
  const merchantFailed = input.merchant === 'rejected' || input.merchant === 'disabled';
  const merchantHeld = input.merchant === 'hold';
  const offeringSuspended = input.offerings.some((o) => o.status === 'suspended');
  const offeringNeedsInfo = input.offerings.some((o) => o.status === 'needs_info');
  const offeringRejected = input.offerings.some((o) => o.status === 'rejected');
  const offeringUnderReview = input.offerings.some((o) => o.status === 'applied' || o.status === 'under_review');

  if (input.identity === 'rejected' || merchantFailed) return 'rejected';
  // An approved offering with everything else ready wins over a separate suspended
  // offering: the provider is dispatchable on the approved one (org-inactive and
  // merchant-hold force eligible=false, so they still resolve to 'suspended').
  if (eligible) return 'active';
  if (!input.orgActive || merchantHeld || offeringSuspended) return 'suspended';
  if (offeringNeedsInfo || offeringRejected) return 'needs_info';
  if (offeringUnderReview) return 'under_review';
  if (!input.documents.allRequiredSatisfied && (input.documents.anyPending || input.documents.anyBlocking)) {
    return 'documents_pending';
  }
  if (input.identity === 'pending' || merchantStep(input.merchant) === 'in_progress') return 'verifying';
  return 'draft';
}
