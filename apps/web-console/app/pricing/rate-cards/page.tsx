'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi } from '../../../lib/api';
import { useLocale, useT } from '../../../lib/i18n';
import { ErrorState, Loading, PageHeader } from '../../../components/page-parts';
import { PrimaryButton } from '../../../components/forms';
import { StatusBadge, formatSar, type PricingStatus } from '../../../components/pricing-parts';

interface RateCardSummary {
  id: string;
  tier_id: string;
  city_id: string;
  zone_id: string | null;
  vehicle_class_id: string | null;
  currency: string;
  base_fare_minor: string;
  flat_fare_minor: string | null;
  minimum_fare_minor: string;
  status: PricingStatus;
  version: number;
}

const short = (id: string): string => id.slice(0, 8);

export default function RateCardsPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const state = useApi<RateCardSummary[]>('/admin/pricing/rate-cards', locale);

  return (
    <>
      <PageHeader title={t('rc.title')} intro={t('rc.intro')} />
      <p style={{ color: 'var(--nx-color-muted-foreground)', fontSize: 13, marginTop: -12, marginBottom: 16 }}>{t('lc.four_eyes')}</p>
      <div style={{ marginBottom: 20 }}>
        <PrimaryButton onClick={() => router.push('/pricing/rate-cards/new')}>{t('rc.new')}</PrimaryButton>
      </div>

      {state.status === 'loading' ? <Loading /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 ? (
          <p style={{ color: 'var(--nx-color-muted-foreground)' }}>{t('common.empty')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'start', color: 'var(--nx-color-muted-foreground)' }}>
                <th style={cellHead}>{t('rc.scope')}</th>
                <th style={cellHead}>{t('lc.version')}</th>
                <th style={cellHead}>{t('rc.fare')}</th>
                <th style={cellHead}>{t('rc.min_fare')}</th>
                <th style={cellHead}>{t('lc.status')}</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--nx-color-border)' }}>
                  <td style={cell}>
                    <Link href={`/pricing/rate-cards/${c.id}`} style={linkStyle}>
                      <code>
                        {short(c.tier_id)} / {short(c.city_id)}
                        {c.zone_id ? ` / ${short(c.zone_id)}` : ''}
                      </code>
                    </Link>
                  </td>
                  <td style={cell}>{c.version}</td>
                  <td style={cell}>{formatSar(c.flat_fare_minor ?? c.base_fare_minor, locale)}</td>
                  <td style={cell}>{formatSar(c.minimum_fare_minor, locale)}</td>
                  <td style={cell}>
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </>
  );
}

const cellHead = { padding: '8px 10px', fontWeight: 600 } as const;
const cell = { padding: '10px' } as const;
const linkStyle = { color: 'var(--nx-color-primary)', whiteSpace: 'nowrap' } as const;
