/**
 * Final pricing at completion (docs/07 section 5 and 6). Pure: decide whether to
 * reprice from the actual distance and time (metered tiers, or a deviation beyond
 * the rate card threshold), then clamp the capture to the authorized amount. The
 * capture can never exceed the authorization; any excess is collected as a separate
 * supplement, never by over-capturing. The caller computes the estimated and actual
 * customer totals with the Phase 3 estimate and fee engines and passes them in.
 */

export interface TripDims {
  distanceKm: number;
  durationMin: number;
}

export interface RepriceInput {
  /** The tier is metered: always reprice from the actual trip. */
  metered: boolean;
  estimated: TripDims;
  actual: TripDims;
  repriceThresholdPct: number;
  /** Customer total (service fare plus customer-borne fees) at estimate time. */
  estimatedTotalMinor: bigint;
  /** Customer total recomputed from the actual trip. */
  actualTotalMinor: bigint;
  /** The amount authorized on the order (estimate total plus buffer). */
  authorizedMinor: bigint;
}

export interface RepriceResult {
  /** Whether the actual trip replaced the estimate. */
  repriced: boolean;
  /** The deviation that drove the decision, as a percentage (0 when not metered and dims match). */
  deviationPct: number;
  /** The final customer total charged. */
  finalTotalMinor: bigint;
  /** What to capture: the final total clamped to the authorized amount. */
  captureMinor: bigint;
  /** The final total exceeds the authorization; collect the delta as a supplement. */
  needsSupplement: boolean;
  supplementMinor: bigint;
}

/** The larger of the distance and duration deviations, as a percentage. */
export function deviationPct(estimated: TripDims, actual: TripDims): number {
  const dim = (est: number, act: number): number => {
    if (est === 0) return act === 0 ? 0 : Infinity;
    return (Math.abs(act - est) / est) * 100;
  };
  return Math.max(dim(estimated.distanceKm, actual.distanceKm), dim(estimated.durationMin, actual.durationMin));
}

const minBig = (a: bigint, b: bigint): bigint => (a < b ? a : b);

export function reprice(input: RepriceInput): RepriceResult {
  const dev = deviationPct(input.estimated, input.actual);
  const repriced = input.metered || dev > input.repriceThresholdPct;
  // Floor at 0: a total or authorization is never negative; guard against an upstream bug.
  const chosen = repriced ? input.actualTotalMinor : input.estimatedTotalMinor;
  const finalTotalMinor = chosen < 0n ? 0n : chosen;
  const authorized = input.authorizedMinor < 0n ? 0n : input.authorizedMinor;

  const captureMinor = minBig(finalTotalMinor, authorized);
  const needsSupplement = finalTotalMinor > authorized;
  const supplementMinor = needsSupplement ? finalTotalMinor - authorized : 0n;

  return {
    repriced,
    deviationPct: dev,
    finalTotalMinor,
    captureMinor,
    needsSupplement,
    supplementMinor,
  };
}
