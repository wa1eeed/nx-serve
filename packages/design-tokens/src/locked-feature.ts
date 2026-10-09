/**
 * The shared model behind the LockedFeature pattern (docs/10, docs/21): a gated
 * feature is shown, not hidden, with a plan badge and an upgrade CTA. Pure, so
 * web and mobile render it identically from i18n keys.
 */
export interface LockedFeatureModel {
  requiredPlan: string;
  badge: string;
  ctaKey: string;
}

export function lockedFeatureModel(requiredPlan: string): LockedFeatureModel {
  return {
    requiredPlan,
    badge: `${requiredPlan} plan`,
    ctaKey: 'upgrade.cta',
  };
}
