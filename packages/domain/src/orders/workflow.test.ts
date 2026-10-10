import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  type Stage,
  WorkflowError,
  abortWorkflow,
  advanceWorkflow,
  missingProof,
  nextStage,
  startWorkflow,
  validateWorkflow,
} from './workflow.js';

// A towing workflow (docs/07 section 3), with the proof placed before the capture
// stage so capture runs only after delivery is proven.
const towing: Stage[] = [
  { code: 'accepted', mapsTo: 'assigned', sortOrder: 1, actor: 'agent', trackingActive: false, requires: {}, paymentAction: 'authorize' },
  { code: 'heading_to_pickup', mapsTo: 'en_route', sortOrder: 2, actor: 'agent', trackingActive: true, requires: {}, paymentAction: 'none' },
  { code: 'arrived_pickup', mapsTo: 'arrived', sortOrder: 3, actor: 'agent', trackingActive: false, requires: { photosMin: 2 }, paymentAction: 'none' },
  { code: 'loading', mapsTo: 'in_progress', sortOrder: 4, actor: 'agent', trackingActive: false, requires: {}, paymentAction: 'none' },
  { code: 'heading_to_dropoff', mapsTo: 'in_progress', sortOrder: 5, actor: 'agent', trackingActive: true, requires: { otp: true, photosMin: 2 }, paymentAction: 'none' },
  { code: 'delivered', mapsTo: 'completed', sortOrder: 6, actor: 'agent', trackingActive: false, requires: {}, paymentAction: 'capture' },
];

describe('startWorkflow', () => {
  it('enters the first stage and authorizes on acceptance', () => {
    const t = startWorkflow(towing);
    expect(t.fromCode).toBeNull();
    expect(t.toCode).toBe('accepted');
    expect(t.toStatus).toBe('assigned');
    expect(t.sideEffects.paymentAction).toBe('authorize');
    expect(t.sideEffects.startTracking).toBe(false);
  });

  it('throws on an empty workflow', () => {
    expect(() => startWorkflow([])).toThrow(WorkflowError);
  });
});

describe('advanceWorkflow', () => {
  it('starts tracking when entering a tracking stage', () => {
    const t = advanceWorkflow({ stages: towing, fromCode: 'accepted', actor: 'agent' });
    expect(t.toCode).toBe('heading_to_pickup');
    expect(t.toStatus).toBe('en_route');
    expect(t.sideEffects.startTracking).toBe(true);
    expect(t.sideEffects.stopTracking).toBe(false);
  });

  it('requires the proof declared by the stage being left', () => {
    expect(() => advanceWorkflow({ stages: towing, fromCode: 'arrived_pickup', actor: 'agent', proof: { photos: 1 } })).toThrow(
      /Missing proof/,
    );
    const ok = advanceWorkflow({ stages: towing, fromCode: 'arrived_pickup', actor: 'agent', proof: { photos: 2 } });
    expect(ok.toCode).toBe('loading');
    expect(ok.toStatus).toBe('in_progress');
  });

  it('captures when entering the delivered stage, after the OTP and photos proof', () => {
    const t = advanceWorkflow({ stages: towing, fromCode: 'heading_to_dropoff', actor: 'agent', proof: { otpValid: true, photos: 2 } });
    expect(t.toCode).toBe('delivered');
    expect(t.toStatus).toBe('completed');
    expect(t.sideEffects.paymentAction).toBe('capture');
    expect(t.sideEffects.stopTracking).toBe(true); // was tracking on heading_to_dropoff
  });

  it('rejects the wrong actor and allows an ops force (with a reason) past proof and actor', () => {
    expect(() => advanceWorkflow({ stages: towing, fromCode: 'accepted', actor: 'customer' })).toThrow(/triggered by agent/);
    expect(() => advanceWorkflow({ stages: towing, fromCode: 'arrived_pickup', actor: 'ops', isOps: true })).toThrow(/reason/);
    const forced = advanceWorkflow({ stages: towing, fromCode: 'arrived_pickup', actor: 'ops', isOps: true, reason: 'manual override' });
    expect(forced.toCode).toBe('loading'); // proof and actor bypassed, reason audited
  });

  it('cannot advance past the final stage', () => {
    expect(() => advanceWorkflow({ stages: towing, fromCode: 'delivered', actor: 'agent' })).toThrow(/final stage/);
  });

  it('reports the proof_incomplete code with the missing keys', () => {
    try {
      advanceWorkflow({ stages: towing, fromCode: 'heading_to_dropoff', actor: 'agent', proof: { photos: 1 } });
      expect.unreachable();
    } catch (e) {
      const err = e as WorkflowError;
      expect(err.code).toBe('proof_incomplete');
      expect(err.missing).toEqual(['photos', 'otp']);
    }
  });
});

describe('abortWorkflow', () => {
  it('moves to cancelled with a reason and stops tracking if active', () => {
    const t = abortWorkflow({ stages: towing, fromCode: 'heading_to_pickup', to: 'cancelled', reason: 'customer no-show' });
    expect(t.toStatus).toBe('cancelled');
    expect(t.stopTracking).toBe(true); // was tracking on heading_to_pickup
  });

  it('requires a reason', () => {
    expect(() => abortWorkflow({ stages: towing, fromCode: 'loading', to: 'failed', reason: '  ' })).toThrow(/reason/);
  });
});

describe('missingProof', () => {
  it('checks photos, otp, signature and checklist', () => {
    expect(missingProof({ photosMin: 2, otp: true, signature: true, checklist: ['a', 'b'] }, {})).toEqual([
      'photos',
      'otp',
      'signature',
      'checklist',
    ]);
    expect(missingProof({ photosMin: 2, otp: true, signature: true, checklist: ['a', 'b'] }, { photos: 2, otpValid: true, signature: true, checklist: ['a', 'b'] })).toEqual([]);
  });
});

describe('validateWorkflow', () => {
  it('accepts a workflow with the proof before the capture stage', () => {
    expect(validateWorkflow(towing)).toEqual([]);
  });

  it('flags proof declared on the terminal stage (it can never be enforced)', () => {
    const bad = towing.map((s) =>
      s.code === 'delivered' ? { ...s, requires: { otp: true, photosMin: 2 } } : s.code === 'heading_to_dropoff' ? { ...s, requires: {} } : s,
    );
    const issues = validateWorkflow(bad);
    expect(issues.some((i) => i.code === 'unenforceable_proof' && i.stageCode === 'delivered')).toBe(true);
    // ...and the capture now has no proof before it.
    expect(issues.some((i) => i.code === 'capture_without_proof' && i.stageCode === 'delivered')).toBe(true);
  });

  it('flags a capture whose preceding stage requires no proof', () => {
    const bad = towing.map((s) => (s.code === 'heading_to_dropoff' ? { ...s, requires: {} } : s));
    expect(validateWorkflow(bad).some((i) => i.code === 'capture_without_proof')).toBe(true);
  });

  it('flags non-distinct sortOrder', () => {
    const bad = towing.map((s) => (s.code === 'loading' ? { ...s, sortOrder: 3 } : s));
    expect(validateWorkflow(bad).some((i) => i.code === 'duplicate_sort_order')).toBe(true);
  });

  it('flags an empty workflow', () => {
    expect(validateWorkflow([]).some((i) => i.code === 'empty_workflow')).toBe(true);
  });
});

describe('property: a full happy path never throws and reaches completed', () => {
  it('advances through every stage in order', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        let t = startWorkflow(towing);
        const proofFor = (code: string): { photos?: number; otpValid?: boolean } =>
          code === 'arrived_pickup' ? { photos: 2 } : code === 'heading_to_dropoff' ? { photos: 2, otpValid: true } : {};
        while (nextStage(towing, t.toCode)) {
          t = advanceWorkflow({ stages: towing, fromCode: t.toCode, actor: 'agent', proof: proofFor(t.toCode) });
        }
        return t.toCode === 'delivered' && t.toStatus === 'completed' && t.sideEffects.paymentAction === 'capture';
      }),
    );
  });
});
