/**
 * Dispatch eligibility evaluator (docs/08 section 3). Pure: decide whether a
 * specific agent and asset of a provider may be offered a specific order, and if
 * not, why (stable reason codes). Scoring (ranking eligible candidates) is a
 * separate concern built with orders in Phase 4; this is the hard gate.
 */
import {
  type AgentPresence,
  type CapabilityMap,
  type MerchantStatus,
  type OfferingStatus,
  isMerchantOperational,
  matchesCapabilities,
} from './common.js';

export interface EligibilityInput {
  org: { isActive: boolean; merchant: MerchantStatus };
  /** The provider's offering that matches the order's category and zone, if any. */
  offering?: { status: OfferingStatus; categoryId?: string | null; zoneId?: string | null; capabilities: CapabilityMap };
  /** Whether the provider's required documents for the category are satisfied. */
  documentsSatisfied: boolean;
  agent: { isActive: boolean; presence: AgentPresence };
  asset?: { isActive: boolean; assetType?: string; attributes: CapabilityMap };
  order: {
    categoryId?: string | null;
    zoneId?: string | null;
    /** Tier required_capabilities merged with the order's match rules. */
    requiredCapabilities?: CapabilityMap;
  };
  probationActive?: boolean;
  /** When a policy restricts to groups, the groups required and the provider's groups. */
  groupRestriction?: { requiredGroupIds: string[]; providerGroupIds: string[] };
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  /** Eligible but on probation: dispatch at lower priority (Phase 4 scoring). */
  probation: boolean;
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const reasons: string[] = [];

  if (!input.org.isActive) reasons.push('org_inactive');
  if (!isMerchantOperational(input.org.merchant)) reasons.push('merchant_inactive');

  if (!input.offering || input.offering.status !== 'approved') {
    reasons.push('offering_not_approved');
  } else {
    const o = input.offering;
    if (input.order.categoryId && o.categoryId && o.categoryId !== input.order.categoryId) {
      reasons.push('category_mismatch');
    }
    // A null offering zone covers all zones; a set zone must match the order's.
    if (input.order.zoneId && o.zoneId && o.zoneId !== input.order.zoneId) {
      reasons.push('zone_mismatch');
    }
  }

  if (!input.documentsSatisfied) reasons.push('documents_invalid');

  if (!input.agent.isActive) reasons.push('agent_inactive');
  else if (input.agent.presence !== 'online') reasons.push('agent_unavailable');

  const required = input.order.requiredCapabilities ?? {};
  const requiresCapabilities = Object.keys(required).length > 0;
  // The asset only matters when the order requires capabilities (docs/08 section 3):
  // an inactive attached asset is irrelevant to a no-capability order.
  if (requiresCapabilities && (!input.asset || !input.asset.isActive)) {
    reasons.push('asset_unavailable');
  }

  if (requiresCapabilities) {
    const provided: CapabilityMap = {
      ...(input.offering?.capabilities ?? {}),
      ...(input.asset?.attributes ?? {}),
      ...(input.asset?.assetType ? { asset_type: input.asset.assetType } : {}),
    };
    if (!matchesCapabilities(required, provided)) reasons.push('capability_mismatch');
  }

  const restriction = input.groupRestriction;
  if (restriction && restriction.requiredGroupIds.length > 0) {
    const inGroup = restriction.requiredGroupIds.some((g) => restriction.providerGroupIds.includes(g));
    if (!inGroup) reasons.push('group_restricted');
  }

  return { eligible: reasons.length === 0, reasons, probation: input.probationActive === true };
}
