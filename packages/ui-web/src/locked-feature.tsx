import * as React from 'react';
import { lockedFeatureModel } from '@nxserve/design-tokens';
import { cn } from './cn.js';
import { Button } from './button.js';

export interface LockedFeatureProps {
  requiredPlan: string;
  ctaLabel: string;
  description?: string;
  onUpgrade?: () => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Gated features are shown, not hidden, with a plan badge and an upgrade CTA
 * (docs/10, docs/21). Labels come from i18n at the call site so this stays
 * presentational and localized.
 */
export function LockedFeature({
  requiredPlan,
  ctaLabel,
  description,
  onUpgrade,
  className,
  children,
}: LockedFeatureProps): React.ReactElement {
  const model = lockedFeatureModel(requiredPlan);
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--nx-color-border)] p-4 flex flex-col gap-2',
        className,
      )}
      role="group"
      aria-label={model.badge}
    >
      <span className="inline-flex w-fit rounded-md bg-[var(--nx-color-accent)] text-[var(--nx-color-accent-foreground)] px-2 py-0.5 text-xs font-medium">
        {model.badge}
      </span>
      {description ? <p className="text-sm text-[var(--nx-color-muted-foreground)]">{description}</p> : null}
      {children}
      <Button onClick={onUpgrade} className="w-fit">
        {ctaLabel}
      </Button>
    </div>
  );
}
