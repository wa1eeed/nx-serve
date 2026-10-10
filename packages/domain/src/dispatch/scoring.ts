/**
 * Dispatch scoring and selection (docs/08 section 3). Pure: rank eligible, online
 * agents for an order and select per the policy mode. The API does eligibility and
 * the routed ETA (Redis GEO); this engine only ranks and selects. Weights are
 * configurable per tenant. Ranking is a deterministic total order so offer rounds
 * and tests are reproducible.
 */

export type DispatchMode = 'auto_nearest' | 'broadcast' | 'manual' | 'customer_choice';

export interface Candidate {
  agentId: string;
  /** Routed ETA to the pickup in minutes (lower is better). */
  etaMinutes: number;
  /** 0..5. */
  rating: number;
  /** 0..1. */
  acceptanceRate: number;
  /** 0..1 (higher is worse). */
  cancellationRate: number;
  /** Membership dispatch boost, >= 0. */
  dispatchBoost: number;
  onProbation: boolean;
  /** Recent assignments in the fairness window (more is worse). */
  recentAssignments: number;
}

export interface ScoringWeights {
  eta: number;
  rating: number;
  acceptance: number;
  cancellation: number;
  boost: number;
  probationPenalty: number;
  fairness: number;
}

/** Sensible defaults; a tenant may override every weight. */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  eta: 1.0,
  rating: 2.0,
  acceptance: 1.5,
  cancellation: 2.0,
  boost: 1.0,
  probationPenalty: 5.0,
  fairness: 0.5,
};

export interface ScoredCandidate extends Candidate {
  score: number;
}

/** A reference ETA in minutes. scoreCandidate scales ETA by this so its term is in the
 * same 0..~12 band as the quality factors, keeping ETA co-equal under the default
 * weights instead of swamping them. */
const ETA_REFERENCE_MIN = 10;

/** Coalesce a non-finite factor to a neutral 0, so a missing stat (a new agent's 0/0
 * rating or acceptance) can never produce a NaN score that corrupts the ranking.
 * Callers should still pass sensible neutral defaults for agents without history. */
const fin = (x: number): number => (Number.isFinite(x) ? x : 0);

/** Higher is better. ETA, cancellation, probation and recent load reduce the score. */
export function scoreCandidate(c: Candidate, w: ScoringWeights): number {
  return (
    // ETA normalized to the reference so its weight is comparable to the quality band.
    -w.eta * (fin(c.etaMinutes) / ETA_REFERENCE_MIN) +
    w.rating * fin(c.rating) +
    // Scale the 0..1 rates to a rating-like 0..5 range so the weights are comparable.
    w.acceptance * fin(c.acceptanceRate) * 5 -
    w.cancellation * fin(c.cancellationRate) * 5 +
    w.boost * fin(c.dispatchBoost) -
    (c.onProbation ? w.probationPenalty : 0) -
    w.fairness * fin(c.recentAssignments)
  );
}

/** Candidates best first. Ties break by ETA then agent id, so the order is total. */
export function rankCandidates(candidates: readonly Candidate[], weights: ScoringWeights = DEFAULT_WEIGHTS): ScoredCandidate[] {
  return candidates
    .map((c) => ({ ...c, score: scoreCandidate(c, weights) }))
    // Code-unit id comparison (not localeCompare) so the total order is the same in
    // every environment, keeping offer rounds and tests reproducible.
    .sort((a, b) => b.score - a.score || a.etaMinutes - b.etaMinutes || (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0));
}

export interface SelectInput {
  mode: DispatchMode;
  candidates: readonly Candidate[];
  weights?: ScoringWeights;
  /** How many to offer at once in broadcast mode (default 5). */
  broadcastSize?: number;
}

/**
 * The agents to offer this round, best first:
 * - auto_nearest: the single best.
 * - broadcast: the top N (first accept wins, claimed atomically by the caller).
 * - customer_choice: all, best first (the customer picks).
 * - manual: none (ops or a fleet dispatcher assigns).
 */
export function selectForMode(input: SelectInput): ScoredCandidate[] {
  const ranked = rankCandidates(input.candidates, input.weights ?? DEFAULT_WEIGHTS);
  switch (input.mode) {
    case 'auto_nearest':
      return ranked.slice(0, 1);
    case 'broadcast': {
      // Guard against a non-integer or NaN size (e.g. a bad dispatch_policies.params
      // value): Math.max(1, NaN) is NaN and slice(0, NaN) would offer to nobody.
      const n = input.broadcastSize;
      const size = typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : 5;
      return ranked.slice(0, size);
    }
    case 'customer_choice':
      return ranked;
    case 'manual':
      return [];
    default:
      // An out-of-union mode (e.g. a stray DB value) offers to nobody rather than
      // returning undefined and crashing the caller.
      return [];
  }
}
