/**
 * Shared provider domain types and capability matching (docs/08). Pure, no IO.
 * The engine stays generic: capabilities and requirements are data, never
 * hard-coded business words.
 */

export type ProviderEntity = 'freelancer' | 'establishment' | 'company';

/** Moyasar merchant lifecycle (mirrors the merchant_status enum). */
export type MerchantStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'missing_docs'
  | 'semi_active'
  | 'active'
  | 'hold'
  | 'rejected'
  | 'disabled';

/** Merchant states in which the provider can take and settle orders. */
export const MERCHANT_OPERATIONAL: readonly MerchantStatus[] = ['semi_active', 'active'];

export function isMerchantOperational(status: MerchantStatus): boolean {
  return MERCHANT_OPERATIONAL.includes(status);
}

export type IdentityStatus = 'pending' | 'verified' | 'rejected';

export type OfferingStatus = 'applied' | 'under_review' | 'needs_info' | 'approved' | 'suspended' | 'rejected';

export type DocScope = 'org' | 'agent' | 'asset';
export type DocReviewStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export type AgentPresence = 'offline' | 'online' | 'busy';

/** A capability value as stored in tier required_capabilities or offering capabilities. */
type Primitive = string | number | boolean;
export type CapabilityMap = Record<string, unknown>;

function satisfiesCapability(required: unknown, provided: unknown): boolean {
  if (Array.isArray(required)) {
    // An empty list imposes no constraint.
    if (required.length === 0) return true;
    if (Array.isArray(provided)) return provided.some((p) => (required as Primitive[]).includes(p as Primitive));
    return provided !== undefined && (required as Primitive[]).includes(provided as Primitive);
  }
  if (typeof required === 'boolean') {
    // `false` is satisfied by an absent capability; `true` must be present and true.
    return provided === required || (required === false && provided === undefined);
  }
  return provided === required;
}

/**
 * Whether `provided` satisfies every constraint in `required` (docs/08 section 3).
 * Array requirement: the provided value must be in the list (or the provided list
 * must intersect it). Boolean requirement: must match. Scalar: must equal.
 */
export function matchesCapabilities(required: CapabilityMap, provided: CapabilityMap): boolean {
  for (const [key, req] of Object.entries(required)) {
    if (!satisfiesCapability(req, provided[key])) return false;
  }
  return true;
}
