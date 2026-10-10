'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useT } from '../../lib/i18n';
import { PageHeader } from '../../components/page-parts';

const TOOLS: { href: string; key: string }[] = [
  { href: '/pricing/rate-cards', key: 'pricing.tool.rate_cards' },
  { href: '/pricing/fee-schedules', key: 'pricing.tool.fee_schedules' },
  { href: '/pricing/surge', key: 'pricing.tool.surge' },
  { href: '/pricing/simulator', key: 'pricing.tool.simulator' },
];

export default function PricingHubPage(): ReactNode {
  const t = useT();
  return (
    <>
      <PageHeader title={t('pricing.hub.title')} intro={t('pricing.hub.intro')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            style={{
              display: 'block',
              padding: 20,
              border: '1px solid var(--nx-color-border)',
              borderRadius: 'var(--nx-radius-lg)',
              background: 'var(--nx-color-card)',
              color: 'var(--nx-color-foreground)',
              textDecoration: 'none',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {t(tool.key)}
          </Link>
        ))}
      </div>
    </>
  );
}
