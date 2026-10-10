import { DomainError } from '../errors.js';

/**
 * The order workflow state machine (docs/07). Pure: given a tenant's configured
 * stages and the order's current stage, it validates a transition and returns the
 * side effects to run. It knows core statuses and capabilities, never business
 * words like "tow truck".
 *
 * Model (docs/07 section 2 and 4):
 * - A stage's `mapsTo`, `paymentAction`, `trackingActive` and `slaMinutes` take
 *   effect when the order ENTERS the stage.
 * - A stage's `requires` (proof) gates LEAVING it; the `actor` of the stage being
 *   ENTERED is who may trigger the move. Ops can force any transition with a reason.
 * - So authorize sits on the first stage (runs on acceptance) and capture sits on a
 *   stage entered after the proof stage, which captures only once delivery is proven.
 * The engine never emits `captured`: capture is a payment action whose confirmation
 * moves the order to `captured` in the payments module.
 */

export type CoreStatus =
  | 'draft'
  | 'quoting'
  | 'awaiting_payment'
  | 'dispatching'
  | 'assigned'
  | 'authorized'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'captured'
  | 'cancelled'
  | 'failed'
  | 'disputed';

/** Statuses from which no further workflow transition is allowed. */
export const TERMINAL_STATUSES: readonly CoreStatus[] = ['captured', 'cancelled', 'failed'];
/** Abort targets reachable from any non-terminal stage per policy or ops. */
export const ABORT_STATUSES: readonly CoreStatus[] = ['cancelled', 'failed', 'disputed'];

export type StageActor = 'agent' | 'customer' | 'system' | 'ops';
export type PaymentAction =
  | 'none'
  | 'authorize'
  | 'capture'
  | 'capture_partial'
  | 'capture_pct'
  | 'deposit'
  | 'supplement';

export interface StageRequirements {
  photosMin?: number;
  otp?: boolean;
  signature?: boolean;
  checklist?: string[];
}

export interface Stage {
  code: string;
  mapsTo: CoreStatus;
  sortOrder: number;
  actor: StageActor;
  trackingActive: boolean;
  requires: StageRequirements;
  paymentAction: PaymentAction;
  slaMinutes?: number | null;
}

/** What the caller has collected; the API verifies the OTP and passes the result. */
export interface ProofProvided {
  photos?: number;
  otpValid?: boolean;
  signature?: boolean;
  checklist?: string[];
}

export interface SideEffects {
  paymentAction: PaymentAction;
  startTracking: boolean;
  stopTracking: boolean;
  slaMinutes: number | null;
}

export interface Transition {
  fromCode: string | null;
  toCode: string;
  toStatus: CoreStatus;
  sideEffects: SideEffects;
}

export class WorkflowError extends DomainError {
  /** Set for proof_incomplete: the unmet requirement keys. */
  readonly missing?: string[];
  constructor(code: string, message: string, missing?: string[]) {
    super(code, message);
    if (missing) this.missing = missing;
  }
}

export function isTerminalStatus(status: CoreStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isCaptureAction(action: PaymentAction): boolean {
  return action === 'capture' || action === 'capture_partial' || action === 'capture_pct';
}

/** Stages in execution order. Does not mutate the input. */
export function sortStages(stages: readonly Stage[]): Stage[] {
  return [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function firstStage(stages: readonly Stage[]): Stage {
  const sorted = sortStages(stages);
  const first = sorted[0];
  if (!first) throw new WorkflowError('empty_workflow', 'The workflow has no stages');
  return first;
}

export function stageByCode(stages: readonly Stage[], code: string): Stage | undefined {
  return stages.find((s) => s.code === code);
}

/** The stage after `code` in execution order, or undefined if `code` is the last. */
export function nextStage(stages: readonly Stage[], code: string): Stage | undefined {
  const sorted = sortStages(stages);
  const idx = sorted.findIndex((s) => s.code === code);
  if (idx === -1) return undefined;
  return sorted[idx + 1];
}

/** The requirement keys a stage declares that the provided proof does not satisfy. */
export function missingProof(requires: StageRequirements, proof: ProofProvided): string[] {
  const missing: string[] = [];
  // Coerce to a safe non-negative count: a NaN or negative photo count is 0, so it
  // can never slip past a photos_min requirement (NaN < 2 is false).
  const photos = typeof proof.photos === 'number' && Number.isFinite(proof.photos) && proof.photos > 0 ? proof.photos : 0;
  if (requires.photosMin !== undefined && requires.photosMin > 0 && photos < requires.photosMin) {
    missing.push('photos');
  }
  if (requires.otp === true && proof.otpValid !== true) missing.push('otp');
  if (requires.signature === true && proof.signature !== true) missing.push('signature');
  if (requires.checklist && requires.checklist.length > 0) {
    const done = new Set(proof.checklist ?? []);
    if (requires.checklist.some((item) => !done.has(item))) missing.push('checklist');
  }
  return missing;
}

/** Whether a stage demands any proof to leave it. */
export function hasRequirements(r: StageRequirements): boolean {
  return (r.photosMin ?? 0) > 0 || r.otp === true || r.signature === true || (r.checklist?.length ?? 0) > 0;
}

export interface WorkflowIssue {
  code: string;
  message: string;
  stageCode?: string;
}

/**
 * Static validation of a workflow's stages, to run at install and admin-edit time.
 * It catches configuration the runtime state machine cannot enforce, above all a
 * capture whose proof could never fire: because `requires` gates LEAVING a stage, a
 * capture must be entered from a stage that itself requires proof, and the final
 * stage's `requires` is dead config. Returns the problems; an empty array is valid.
 */
export function validateWorkflow(stages: readonly Stage[]): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  if (stages.length === 0) {
    issues.push({ code: 'empty_workflow', message: 'The workflow has no stages' });
    return issues;
  }
  const sorted = sortStages(stages);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev && cur && cur.sortOrder <= prev.sortOrder) {
      issues.push({ code: 'duplicate_sort_order', message: 'Stages must have strictly increasing sortOrder', stageCode: cur.code });
    }
  }
  const last = sorted[sorted.length - 1];
  if (last && hasRequirements(last.requires)) {
    issues.push({
      code: 'unenforceable_proof',
      message: `The final stage ${last.code} declares proof that can never be enforced; move it to the preceding stage`,
      stageCode: last.code,
    });
  }
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (!s || !isCaptureAction(s.paymentAction)) continue;
    const prev = sorted[i - 1];
    if (!prev || !hasRequirements(prev.requires)) {
      issues.push({
        code: 'capture_without_proof',
        message: `Stage ${s.code} captures but the stage entered before it requires no proof; capture would fire with no proof of completion`,
        stageCode: s.code,
      });
    }
  }
  return issues;
}

/** The transition that starts an order's workflow: enter the first stage. */
export function startWorkflow(stages: readonly Stage[]): Transition {
  const first = firstStage(stages);
  return {
    fromCode: null,
    toCode: first.code,
    toStatus: first.mapsTo,
    sideEffects: {
      paymentAction: first.paymentAction,
      startTracking: first.trackingActive,
      stopTracking: false,
      slaMinutes: first.slaMinutes ?? null,
    },
  };
}

export interface AdvanceInput {
  stages: readonly Stage[];
  fromCode: string;
  actor: StageActor;
  proof?: ProofProvided;
  /** Ops force transition: bypasses the proof and actor gates. Requires a `reason`. */
  isOps?: boolean;
  /** The audited reason, required when forcing (isOps). */
  reason?: string;
}

/** Complete the current stage and enter the next one, returning the transition. */
export function advanceWorkflow(input: AdvanceInput): Transition {
  const { stages, fromCode, actor, proof = {}, isOps = false, reason } = input;
  const from = stageByCode(stages, fromCode);
  if (!from) throw new WorkflowError('unknown_stage', `No stage ${fromCode} in this workflow`);

  const next = nextStage(stages, fromCode);
  if (!next) {
    throw new WorkflowError('no_next_stage', `Stage ${fromCode} is the final stage; it cannot be advanced`);
  }

  if (isOps) {
    // Parity with abort: a forced transition (past the proof and actor gates) is audited.
    if (!reason || !reason.trim()) throw new WorkflowError('reason_required', 'A forced advance needs a reason');
  } else {
    const missing = missingProof(from.requires, proof);
    if (missing.length > 0) {
      throw new WorkflowError('proof_incomplete', `Missing proof to leave ${fromCode}: ${missing.join(', ')}`, missing);
    }
    if (actor !== next.actor) {
      throw new WorkflowError('actor_not_allowed', `Stage ${next.code} is triggered by ${next.actor}, not ${actor}`);
    }
  }

  return {
    fromCode,
    toCode: next.code,
    toStatus: next.mapsTo,
    sideEffects: {
      paymentAction: next.paymentAction,
      startTracking: next.trackingActive && !from.trackingActive,
      stopTracking: from.trackingActive && !next.trackingActive,
      slaMinutes: next.slaMinutes ?? null,
    },
  };
}

export interface AbortInput {
  stages: readonly Stage[];
  fromCode: string;
  to: Extract<CoreStatus, 'cancelled' | 'failed' | 'disputed'>;
  reason: string;
}

/**
 * An abort transition. It carries no payment action on purpose: the money reversal
 * for a cancellation (a void, or a partial capture for a fee) is decided separately
 * by resolveCancellation, so a caller can never read a 'none' here as "the
 * authorization is already handled" and skip reversing it.
 */
export interface AbortTransition {
  fromCode: string;
  toCode: string;
  toStatus: CoreStatus;
  stopTracking: boolean;
}

/** Move an order to an abort status (cancelled, failed, disputed) from any stage.
 * The caller must resolve the money outcome with resolveCancellation. */
export function abortWorkflow(input: AbortInput): AbortTransition {
  const { stages, fromCode, to, reason } = input;
  if (!reason.trim()) throw new WorkflowError('reason_required', 'An abort transition needs a reason');
  const from = stageByCode(stages, fromCode);
  if (!from) throw new WorkflowError('unknown_stage', `No stage ${fromCode} in this workflow`);
  return { fromCode, toCode: to, toStatus: to, stopTracking: from.trackingActive };
}
