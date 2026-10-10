import { describe, expect, it } from 'vitest';
import { type EligibilityInput, evaluateEligibility } from './eligibility.js';
import { matchesCapabilities } from './common.js';

const base: EligibilityInput = {
  org: { isActive: true, merchant: 'active' },
  offering: { status: 'approved', categoryId: 'cat1', zoneId: null, capabilities: { asset_type: ['flatbed'] } },
  documentsSatisfied: true,
  agent: { isActive: true, presence: 'online' },
  asset: { isActive: true, assetType: 'flatbed', attributes: { hydraulic: true } },
  order: { categoryId: 'cat1', zoneId: 'z1', requiredCapabilities: { asset_type: ['flatbed'], hydraulic: true } },
};

describe('evaluateEligibility', () => {
  it('is eligible when everything matches', () => {
    const r = evaluateEligibility(base);
    expect(r.eligible).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.probation).toBe(false);
  });

  it('blocks an inactive org and non-operational merchant', () => {
    expect(evaluateEligibility({ ...base, org: { isActive: false, merchant: 'active' } }).reasons).toContain('org_inactive');
    expect(evaluateEligibility({ ...base, org: { isActive: true, merchant: 'hold' } }).reasons).toContain('merchant_inactive');
  });

  it('requires an approved offering', () => {
    expect(evaluateEligibility({ ...base, offering: undefined }).reasons).toContain('offering_not_approved');
    expect(
      evaluateEligibility({ ...base, offering: { ...base.offering!, status: 'under_review' } }).reasons,
    ).toContain('offering_not_approved');
  });

  it('detects category and zone mismatch', () => {
    expect(evaluateEligibility({ ...base, order: { ...base.order, categoryId: 'other' } }).reasons).toContain('category_mismatch');
    const zoned = evaluateEligibility({
      ...base,
      offering: { ...base.offering!, zoneId: 'zA' },
      order: { ...base.order, zoneId: 'zB' },
    });
    expect(zoned.reasons).toContain('zone_mismatch');
  });

  it('a null offering zone covers any order zone', () => {
    const r = evaluateEligibility({ ...base, offering: { ...base.offering!, zoneId: null }, order: { ...base.order, zoneId: 'zX' } });
    expect(r.reasons).not.toContain('zone_mismatch');
  });

  it('blocks invalid documents', () => {
    expect(evaluateEligibility({ ...base, documentsSatisfied: false }).reasons).toContain('documents_invalid');
  });

  it('blocks an offline or busy agent', () => {
    expect(evaluateEligibility({ ...base, agent: { isActive: true, presence: 'offline' } }).reasons).toContain('agent_unavailable');
    expect(evaluateEligibility({ ...base, agent: { isActive: true, presence: 'busy' } }).reasons).toContain('agent_unavailable');
    expect(evaluateEligibility({ ...base, agent: { isActive: false, presence: 'online' } }).reasons).toContain('agent_inactive');
  });

  it('requires an active asset when capabilities are needed', () => {
    expect(evaluateEligibility({ ...base, asset: undefined }).reasons).toContain('asset_unavailable');
    expect(evaluateEligibility({ ...base, asset: { ...base.asset!, isActive: false } }).reasons).toContain('asset_unavailable');
  });

  it('detects capability mismatch (hydraulic required but asset is not)', () => {
    const r = evaluateEligibility({ ...base, asset: { isActive: true, assetType: 'flatbed', attributes: { hydraulic: false } } });
    expect(r.reasons).toContain('capability_mismatch');
  });

  it('needs no asset when the order requires no capabilities', () => {
    const r = evaluateEligibility({ ...base, asset: undefined, order: { categoryId: 'cat1', zoneId: 'z1' } });
    expect(r.eligible).toBe(true);
  });

  it('ignores an inactive attached asset when the order requires no capabilities', () => {
    const r = evaluateEligibility({
      ...base,
      asset: { isActive: false, assetType: 'flatbed', attributes: {} },
      order: { categoryId: 'cat1', zoneId: 'z1' },
    });
    expect(r.eligible).toBe(true);
    expect(r.reasons).not.toContain('asset_unavailable');
  });

  it('enforces group restriction', () => {
    const r = evaluateEligibility({ ...base, groupRestriction: { requiredGroupIds: ['vip'], providerGroupIds: ['std'] } });
    expect(r.reasons).toContain('group_restricted');
    const ok = evaluateEligibility({ ...base, groupRestriction: { requiredGroupIds: ['vip'], providerGroupIds: ['vip'] } });
    expect(ok.reasons).not.toContain('group_restricted');
  });

  it('reports probation without blocking', () => {
    const r = evaluateEligibility({ ...base, probationActive: true });
    expect(r.eligible).toBe(true);
    expect(r.probation).toBe(true);
  });
});

describe('matchesCapabilities', () => {
  it('matches array requirements against scalar and array provided', () => {
    expect(matchesCapabilities({ asset_type: ['flatbed'] }, { asset_type: 'flatbed' })).toBe(true);
    expect(matchesCapabilities({ asset_type: ['flatbed', 'enclosed'] }, { asset_type: 'enclosed' })).toBe(true);
    expect(matchesCapabilities({ asset_type: ['flatbed'] }, { asset_type: 'wheel_lift' })).toBe(false);
  });

  it('matches boolean and treats false as satisfied by absence', () => {
    expect(matchesCapabilities({ hydraulic: true }, { hydraulic: true })).toBe(true);
    expect(matchesCapabilities({ hydraulic: true }, {})).toBe(false);
    expect(matchesCapabilities({ enclosed: false }, {})).toBe(true);
  });

  it('an empty required map always matches', () => {
    expect(matchesCapabilities({}, { anything: 1 })).toBe(true);
  });
});
