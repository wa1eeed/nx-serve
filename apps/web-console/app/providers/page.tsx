'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useApi } from '../../lib/api';
import { useLocale, useT } from '../../lib/i18n';
import type { ProviderOrgDetail } from '../../lib/types';
import { ErrorState, Loading, PageHeader } from '../../components/page-parts';

export default function ProvidersPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const state = useApi<ProviderOrgDetail[]>('/admin/providers', locale);

  return (
    <>
      <PageHeader title={t('providers.title')} intro={t('providers.intro')} />
      <p style={{ marginBottom: 20 }}>
        <Link href="/provider-groups" style={{ color: 'var(--nx-color-primary)' }}>
          {t('groups.title')}
        </Link>
      </p>
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
                <th style={cellHead}>{t('providers.entity')}</th>
                <th style={cellHead}>{t('providers.merchant')}</th>
                <th style={cellHead}>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--nx-color-border)' }}>
                  <td style={cell}>
                    <Link href={`/providers/${p.id}`} style={{ color: 'var(--nx-color-primary)' }}>
                      {p.display_name}
                    </Link>
                  </td>
                  <td style={cell}>{p.entity_type}</td>
                  <td style={cell}>
                    <code>{p.moyasar_status}</code>
                  </td>
                  <td style={cell}>{p.is_active ? '●' : '○'}</td>
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
