/**
 * Document requirement resolver (docs/08 section 2 step 4). Pure: given the per
 * category document checklist (`category_requirements`) and a provider's uploaded
 * documents, compute which requirements are satisfied, pending, missing, rejected,
 * expired or expiring, at a reference date. Expiry drives reminders and automatic
 * suspension (the caller acts on the result).
 */
import { type DocReviewStatus, type DocScope } from './common.js';

export interface CategoryRequirement {
  docType: string;
  appliesTo: DocScope;
  required: boolean;
  /** Whether the document carries an expiry date (expiring documents are tracked). */
  expires: boolean;
}

export interface ProviderDocument {
  docType: string;
  appliesTo: DocScope;
  status: DocReviewStatus;
  /** ISO date (YYYY-MM-DD) or null when the document does not expire. */
  expiresOn?: string | null;
}

export type RequirementState = 'satisfied' | 'pending' | 'rejected' | 'expired' | 'missing';

export interface RequirementResult {
  docType: string;
  appliesTo: DocScope;
  required: boolean;
  state: RequirementState;
  expiringSoon: boolean;
}

export interface DocumentsResult {
  items: RequirementResult[];
  /** True when every required requirement is satisfied. */
  allRequiredSatisfied: boolean;
  /** Required requirements that block eligibility (missing, rejected or expired). */
  blockingRequired: string[];
  /** Required requirements awaiting review. */
  pendingRequired: string[];
  /** Satisfied requirements whose document expires within the window. */
  expiring: string[];
}

export interface ResolveDocumentsInput {
  requirements: CategoryRequirement[];
  documents: ProviderDocument[];
  /** Reference instant (ISO). */
  now: string;
  /** Days ahead that count as expiring soon. Default 30. */
  expiringWithinDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(value: string): number {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** The effective state a single document contributes for a requirement. */
function documentState(doc: ProviderDocument, nowTime: number, expires: boolean): RequirementState {
  if (doc.status === 'rejected') return 'rejected';
  if (doc.status === 'expired') return 'expired';
  if (doc.status === 'pending') return 'pending';
  // verified
  if (expires && doc.expiresOn && toTime(doc.expiresOn) < nowTime) return 'expired';
  return 'satisfied';
}

// Best (most satisfied) state wins when several documents match a requirement.
const RANK: Record<RequirementState, number> = { satisfied: 4, pending: 3, expired: 2, rejected: 1, missing: 0 };

export function resolveDocuments(input: ResolveDocumentsInput): DocumentsResult {
  const nowTime = toTime(input.now);
  const windowMs = (input.expiringWithinDays ?? 30) * DAY_MS;

  const items: RequirementResult[] = input.requirements.map((req) => {
    const matches = input.documents.filter((d) => d.docType === req.docType && d.appliesTo === req.appliesTo);

    let state: RequirementState = 'missing';
    // The requirement's real coverage is the latest expiry among satisfying
    // documents; a renewal that extends past the window clears the reminder.
    let maxSatisfiedExp = -Infinity;
    for (const doc of matches) {
      const s = documentState(doc, nowTime, req.expires);
      if (RANK[s] > RANK[state]) state = s;
      if (s === 'satisfied') {
        const exp = req.expires && doc.expiresOn ? toTime(doc.expiresOn) : Infinity;
        if (exp > maxSatisfiedExp) maxSatisfiedExp = exp;
      }
    }

    const expiringSoon =
      state === 'satisfied' &&
      Number.isFinite(maxSatisfiedExp) &&
      maxSatisfiedExp >= nowTime &&
      maxSatisfiedExp <= nowTime + windowMs;

    return { docType: req.docType, appliesTo: req.appliesTo, required: req.required, state, expiringSoon };
  });

  const blockingRequired = items
    .filter((i) => i.required && (i.state === 'missing' || i.state === 'rejected' || i.state === 'expired'))
    .map((i) => i.docType);
  const pendingRequired = items.filter((i) => i.required && i.state === 'pending').map((i) => i.docType);
  const expiring = items.filter((i) => i.expiringSoon).map((i) => i.docType);
  const allRequiredSatisfied = items.filter((i) => i.required).every((i) => i.state === 'satisfied');

  return { items, allRequiredSatisfied, blockingRequired, pendingRequired, expiring };
}
