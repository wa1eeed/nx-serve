'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useT } from '../lib/i18n';
import { PageHeader } from '../components/page-parts';

const CARDS: { href: string; titleKey: string; bodyKey: string }[] = [
  { href: '/catalog/verticals', titleKey: 'nav.verticals', bodyKey: 'verticals.intro' },
  { href: '/settings', titleKey: 'nav.settings', bodyKey: 'settings.intro' },
];

export default function Home(): ReactNode {
  const t = useT();
  return (
    <>
      <PageHeader title={t('app.title')} intro={t('app.subtitle')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              display: 'block',
              padding: 20,
              borderRadius: 'var(--nx-radius-lg)',
              border: '1px solid var(--nx-color-border)',
              background: 'var(--nx-color-card)',
              textDecoration: 'none',
              color: 'var(--nx-color-foreground)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{t(card.titleKey)}</div>
            <div style={{ fontSize: 14, color: 'var(--nx-color-muted-foreground)' }}>{t(card.bodyKey)}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
