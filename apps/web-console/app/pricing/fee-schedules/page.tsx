'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi } from '../../../lib/api';
import { useLocale, useT, type Locale } from '../../../lib/i18n';
import { ErrorState, Loading, PageHeader } from '../../../components/page-parts';
import { PrimaryButton } from '../../../components/forms';
import { StatusBadge, type PricingStatus } from '../../../components/pricing-parts';

interface FeeScheduleSummary {
  id: string;
  name: Record<string, string>;
  gateway_fee_bearer: 'provider' | 'platform';
  priority: number;
  status: PricingStatus;
  version: number;
  component_count: number;
}

const localName = (name: Record<string, string>, locale: Locale): string => name[locale] ?? name.en ?? '';

export default function FeeSchedulesPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const state = useApi<FeeScheduleSummary[]>('/admin/pricing/fee-schedules', locale);

  return (
    <>
      <PageHeader title={t('fs.title')} intro={t('fs.intro')} />
      <p style={{ color: 'var(--nx-color-muted-foreground)', fontSize: 13, marginTop: -12, marginBottom: 16 }}>{t('lc.four_eyes')}</p>
      <div style={{ marginBottom: 20 }}>
        <PrimaryButton onClick={() => router.push('/pricing/fee-schedules/new')}>{t('fs.new')}</PrimaryButton>
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
                <th style={cellHead}>{t('common.name')}</th>
                <th style={cellHead}>{t('fs.gateway_bearer')}</th>
                <th style={cellHead}>{t('fs.components')}</th>
                <th style={cellHead}>{t('lc.version')}</th>
                <th style={cellHead}>{t('lc.status')}</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--nx-color-border)' }}>
                  <td style={cell}>
                    <Link href={`/pricing/fee-schedules/${s.id}`} style={linkStyle}>
                      {localName(s.name, locale)}
                    </Link>
                  </td>
                  <td style={cell}>{s.gateway_fee_bearer}</td>
                  <td style={cell}>{s.component_count}</td>
                  <td style={cell}>{s.version}</td>
                  <td style={cell}>
                    <StatusBadge status={s.status} />
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
