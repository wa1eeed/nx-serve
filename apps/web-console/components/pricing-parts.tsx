'use client';
import type { ReactNode } from 'react';
import { translate, useLocale, type Locale } from '../lib/i18n';

export type PricingStatus = 'draft' | 'pending_approval' | 'active' | 'archived';

const STATUS_COLOR: Record<PricingStatus, string> = {
  draft: 'var(--nx-color-muted-foreground)',
  pending_approval: 'var(--nx-color-primary)',
  active: '#16a34a',
  archived: 'var(--nx-color-muted-foreground)',
};

/** A small colored chip for a maker-checker status, labelled in the current locale. */
export function StatusBadge({ status }: { status: PricingStatus }): ReactNode {
  const locale = useLocale();
  const color = STATUS_COLOR[status] ?? 'var(--nx-color-muted-foreground)';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        border: `1px solid ${color}`,
        color,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {translate(locale, `lc.status.${status}`)}
    </span>
  );
}

/** SAR major units (what the user types) to integer minor units (what the API wants).
 * Clamped to non-negative: money is never negative, and a stray minus would fail the
 * API's NonNegMinor validation. */
export function toMinor(sarValue: string): string {
  return String(Math.max(0, Math.round((Number(sarValue) || 0) * 100)));
}

/** Integer minor units from the API to a SAR major-unit string for an input. */
export function fromMinor(minor: string | null | undefined): string {
  if (minor === null || minor === undefined) return '';
  return String(Number(minor) / 100);
}

/** Formats a minor-unit amount as localized SAR currency. */
export function formatSar(minor: string | null | undefined, locale: Locale): string {
  if (minor === null || minor === undefined) return '-';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  }).format(Number(minor) / 100);
}
