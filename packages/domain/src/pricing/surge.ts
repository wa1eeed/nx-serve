/**
 * Surge calculator (docs/09 section 5). Combines scheduled surge (the multipliers
 * of the schedule rows that match the time and place) with dynamic surge (a step
 * table over the demand-to-supply ratio), by max or multiply, capped. The customer
 * must acknowledge any surge above 1 before confirming. Pure.
 */

export interface DynamicStep {
  /** Demand-to-supply ratio at or above which this multiplier applies. */
  threshold: number;
  multiplier: number;
}

export interface DynamicSurge {
  demand: number;
  supply: number;
  steps: DynamicStep[];
  maxMultiplier: number;
}

export interface SurgeInput {
  /** Multipliers of the matching scheduled-surge rows (each >= 1). */
  scheduled?: number[];
  dynamic?: DynamicSurge | null;
  /** How to combine scheduled with dynamic (default 'max'). */
  combine?: 'max' | 'multiply';
  requiresAck?: boolean;
}

export interface SurgeResult {
  multiplier: number;
  /** Whether the customer must acknowledge the surge (docs/09 section 5). */
  requiresAck: boolean;
}

function dynamicMultiplier(d: DynamicSurge): number {
  const ratio = d.supply > 0 ? d.demand / d.supply : d.demand > 0 ? Infinity : 0;
  let m = 1;
  for (const step of [...d.steps].sort((a, b) => a.threshold - b.threshold)) {
    if (ratio >= step.threshold) m = step.multiplier;
  }
  return Math.min(m, d.maxMultiplier);
}

export function combineSurge(input: SurgeInput): SurgeResult {
  const scheduled = (input.scheduled ?? []).reduce((max, v) => Math.max(max, v), 1);
  const dynamic = input.dynamic ? dynamicMultiplier(input.dynamic) : 1;
  let combined = input.combine === 'multiply' ? scheduled * dynamic : Math.max(scheduled, dynamic);
  combined = Math.max(1, combined);
  return { multiplier: combined, requiresAck: input.requiresAck ?? combined > 1 };
}
