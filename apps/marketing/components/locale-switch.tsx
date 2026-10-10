'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Locale } from '../lib/i18n';

/** Switches locale while keeping the current path (e.g. /ar/pricing to /en/pricing). */
export function LocaleSwitch({ locale }: { locale: Locale }): ReactNode {
  const pathname = usePathname() ?? `/${locale}`;
  const other: Locale = locale === 'ar' ? 'en' : 'ar';
  const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, '');
  return (
    <Link
      href={`/${other}${rest}`}
      style={{
        fontSize: 14,
        color: 'var(--nx-color-foreground)',
        textDecoration: 'none',
        padding: '6px 12px',
        border: '1px solid var(--nx-color-border)',
        borderRadius: 'var(--nx-radius-md)',
      }}
    >
      {other === 'ar' ? 'العربية' : 'English'}
    </Link>
  );
}
