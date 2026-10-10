import { describe, expect, it } from 'vitest';
import { type OnboardingInput, resolveOnboarding } from './onboarding.js';

const docsSatisfied = { allRequiredSatisfied: true, anyPending: false, anyBlocking: false };
const docsPending = { allRequiredSatisfied: false, anyPending: true, anyBlocking: false };

const base: OnboardingInput = {
  orgActive: true,
  identity: 'verified',
  merchant: 'active',
  documents: docsSatisfied,
  offerings: [{ status: 'approved' }],
};

describe('resolveOnboarding', () => {
  it('is active and eligible when all steps are done', () => {
    const r = resolveOnboarding(base);
    expect(r.state).toBe('active');
    expect(r.eligibleForDispatch).toBe(true);
    expect(r.blockers).toEqual([]);
    expect(r.steps).toEqual({ identity: 'done', merchant: 'done', documents: 'done', approval: 'done' });
  });

  it('starts in draft with nothing done', () => {
    const r = resolveOnboarding({
      orgActive: true,
      identity: 'pending',
      merchant: 'draft',
      documents: { allRequiredSatisfied: false, anyPending: false, anyBlocking: false },
      offerings: [],
    });
    expect(r.eligibleForDispatch).toBe(false);
    expect(r.steps.merchant).toBe('pending');
    // identity pending → verifying
    expect(r.state).toBe('verifying');
  });

  it('is documents_pending when identity and merchant are set but docs are not', () => {
    const r = resolveOnboarding({ ...base, documents: docsPending, offerings: [] });
    expect(r.state).toBe('documents_pending');
    expect(r.eligibleForDispatch).toBe(false);
    expect(r.blockers).toContain('documents_incomplete');
  });

  it('is under_review while an offering is applied', () => {
    const r = resolveOnboarding({ ...base, offerings: [{ status: 'under_review' }] });
    expect(r.state).toBe('under_review');
    expect(r.blockers).toContain('no_approved_offering');
  });

  it('is needs_info when an offering needs info', () => {
    const r = resolveOnboarding({ ...base, offerings: [{ status: 'needs_info' }] });
    expect(r.state).toBe('needs_info');
    expect(r.steps.approval).toBe('blocked');
  });

  it('is rejected when identity is rejected', () => {
    const r = resolveOnboarding({ ...base, identity: 'rejected' });
    expect(r.state).toBe('rejected');
    expect(r.eligibleForDispatch).toBe(false);
  });

  it('is rejected when the merchant is rejected or disabled', () => {
    expect(resolveOnboarding({ ...base, merchant: 'rejected' }).state).toBe('rejected');
    expect(resolveOnboarding({ ...base, merchant: 'disabled' }).state).toBe('rejected');
  });

  it('is suspended when the org is inactive or an offering is suspended or merchant on hold', () => {
    expect(resolveOnboarding({ ...base, orgActive: false }).state).toBe('suspended');
    expect(resolveOnboarding({ ...base, merchant: 'hold' }).state).toBe('suspended');
    expect(resolveOnboarding({ ...base, offerings: [{ status: 'suspended' }] }).state).toBe('suspended');
  });

  it('treats semi_active as an operational merchant', () => {
    const r = resolveOnboarding({ ...base, merchant: 'semi_active' });
    expect(r.eligibleForDispatch).toBe(true);
    expect(r.steps.merchant).toBe('done');
  });

  it('requires an approved offering for eligibility even when everything else is ready', () => {
    const r = resolveOnboarding({ ...base, offerings: [{ status: 'applied' }] });
    expect(r.eligibleForDispatch).toBe(false);
  });

  it('is active (not suspended) when one offering is approved and another is suspended', () => {
    const r = resolveOnboarding({ ...base, offerings: [{ status: 'approved' }, { status: 'suspended' }] });
    expect(r.state).toBe('active');
    expect(r.eligibleForDispatch).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it('never reports eligible for dispatch without an active state', () => {
    // Guards the invariant the mixed approved/suspended case exposed.
    const r = resolveOnboarding({ ...base, offerings: [{ status: 'approved' }, { status: 'suspended' }] });
    expect(!r.eligibleForDispatch || r.state === 'active').toBe(true);
  });

  it('surfaces a rejected-only offering as needs_info with the approval step blocked', () => {
    const r = resolveOnboarding({ ...base, offerings: [{ status: 'rejected' }] });
    expect(r.state).toBe('needs_info');
    expect(r.steps.approval).toBe('blocked');
    expect(r.eligibleForDispatch).toBe(false);
    expect(r.blockers).toContain('no_approved_offering');
  });
});
