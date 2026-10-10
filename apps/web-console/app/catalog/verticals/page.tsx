'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useApi } from '../../../lib/api';
import { useLocale, useT, type Locale } from '../../../lib/i18n';
import { ErrorState, Loading, PageHeader } from '../../../components/page-parts';

interface VerticalSummary {
  id: string;
  code: string;
  name: Record<string, string>;
  default_fulfillment: string;
  default_tracking: string;
  is_active: boolean;
}

function localName(name: Record<string, string>, locale: Locale): string {
  return name[locale] ?? name.en ?? '';
}

export default function VerticalsPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const state = useApi<VerticalSummary[]>('/catalog/verticals', locale);

  return (
    <>
      <PageHeader title={t('verticals.title')} intro={t('verticals.intro')} />
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
                <th style={cellHead}>{t('common.code')}</th>
                <th style={cellHead}>{t('common.status')}</th>
                <th style={cellHead}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((v) => (
                <tr key={v.id} style={{ borderTop: '1px solid var(--nx-color-border)' }}>
                  <td style={cell}>{localName(v.name, locale)}</td>
                  <td style={cell}>
                    <code>{v.code}</code>
                  </td>
                  <td style={cell}>{v.is_active ? '●' : '○'}</td>
                  <td style={cell}>
                    <Link href={`/catalog/verticals/${v.id}/form`} style={{ color: 'var(--nx-color-primary)' }}>
                      {t('verticals.preview')}
                    </Link>
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
