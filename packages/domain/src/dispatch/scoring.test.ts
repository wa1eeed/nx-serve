import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { type Candidate, DEFAULT_WEIGHTS, rankCandidates, scoreCandidate, selectForMode } from './scoring.js';

const base: Omit<Candidate, 'agentId'> = {
  etaMinutes: 10,
  rating: 4,
  acceptanceRate: 0.9,
  cancellationRate: 0.05,
  dispatchBoost: 0,
  onProbation: false,
  recentAssignments: 0,
};

describe('rankCandidates', () => {
  it('ranks a closer, higher-rated agent above a far, low-rated one', () => {
    const a: Candidate = { ...base, agentId: 'a', etaMinutes: 5, rating: 5 };
    const b: Candidate = { ...base, agentId: 'b', etaMinutes: 40, rating: 2 };
    const ranked = rankCandidates([b, a]);
    expect(ranked[0]?.agentId).toBe('a');
    expect(ranked[1]?.agentId).toBe('b');
  });

  it('penalizes probation and high cancellation', () => {
    const good: Candidate = { ...base, agentId: 'good' };
    const prob: Candidate = { ...base, agentId: 'prob', onProbation: true };
    expect(scoreCandidate(good, DEFAULT_WEIGHTS)).toBeGreaterThan(scoreCandidate(prob, DEFAULT_WEIGHTS));
    const reliable: Candidate = { ...base, agentId: 'rel', cancellationRate: 0 };
    const flaky: Candidate = { ...base, agentId: 'flaky', cancellationRate: 0.5 };
    expect(scoreCandidate(reliable, DEFAULT_WEIGHTS)).toBeGreaterThan(scoreCandidate(flaky, DEFAULT_WEIGHTS));
  });

  it('uses a stable total-order tiebreak (eta then agentId)', () => {
    const a: Candidate = { ...base, agentId: 'zzz' };
    const b: Candidate = { ...base, agentId: 'aaa' };
    const ranked = rankCandidates([a, b]);
    // Identical scores and eta, so agentId breaks the tie.
    expect(ranked.map((c) => c.agentId)).toEqual(['aaa', 'zzz']);
  });
});

describe('selectForMode', () => {
  const candidates: Candidate[] = Array.from({ length: 8 }, (_, i) => ({ ...base, agentId: `a${i}`, etaMinutes: i + 1 }));

  it('auto_nearest offers the single best', () => {
    expect(selectForMode({ mode: 'auto_nearest', candidates }).length).toBe(1);
  });

  it('broadcast offers the top N', () => {
    expect(selectForMode({ mode: 'broadcast', candidates, broadcastSize: 3 }).length).toBe(3);
  });

  it('customer_choice offers all, best first', () => {
    const sel = selectForMode({ mode: 'customer_choice', candidates });
    expect(sel.length).toBe(8);
    expect(sel[0]?.etaMinutes).toBe(1);
  });

  it('manual offers none', () => {
    expect(selectForMode({ mode: 'manual', candidates }).length).toBe(0);
  });
});

describe('property: ranking is a total order and the best has the max score', () => {
  const candidateArb = fc.record({
    agentId: fc.string({ minLength: 1, maxLength: 6 }),
    etaMinutes: fc.integer({ min: 1, max: 120 }),
    rating: fc.float({ min: 0, max: 5, noNaN: true }),
    acceptanceRate: fc.float({ min: 0, max: 1, noNaN: true }),
    cancellationRate: fc.float({ min: 0, max: 1, noNaN: true }),
    dispatchBoost: fc.float({ min: 0, max: 10, noNaN: true }),
    onProbation: fc.boolean(),
    recentAssignments: fc.integer({ min: 0, max: 20 }),
  });

  it('is sorted non-increasing by score and preserves every candidate', () => {
    fc.assert(
      fc.property(fc.uniqueArray(candidateArb, { minLength: 1, maxLength: 12, selector: (c) => c.agentId }), (candidates) => {
        const ranked = rankCandidates(candidates);
        if (ranked.length !== candidates.length) return false;
        for (let i = 1; i < ranked.length; i++) {
          if ((ranked[i - 1]?.score ?? 0) < (ranked[i]?.score ?? 0)) return false; // monotonic non-increasing
        }
        return ranked.every((c) => Number.isFinite(c.score));
      }),
    );
  });

  it('a new agent with no history (0/0 stats => NaN) still gets a finite score and never outranks a known-good agent', () => {
    const newAgent: Candidate = { agentId: 'new', etaMinutes: 3, rating: NaN, acceptanceRate: NaN, cancellationRate: NaN, dispatchBoost: 0, onProbation: false, recentAssignments: 0 };
    const known: Candidate = { ...base, agentId: 'known', etaMinutes: 8 };
    const ranked = rankCandidates([newAgent, known]);
    expect(ranked.every((c) => Number.isFinite(c.score))).toBe(true);
    expect(ranked[0]?.agentId).toBe('known'); // the finite good agent wins despite the lower-ETA new agent
  });
});
