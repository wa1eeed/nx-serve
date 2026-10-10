'use client';
import type { ReactNode } from 'react';
import { useApi } from '../../lib/api';
import { useLocale, useT } from '../../lib/i18n';
import { ErrorState, Loading, PageHeader } from '../../components/page-parts';

export default function SettingsPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const state = useApi<Record<string, unknown>>('/settings', locale);

  return (
    <>
      <PageHeader title={t('settings.title')} intro={t('settings.intro')} />
      {state.status === 'loading' ? <Loading /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {state.status === 'ready' ? (
        Object.keys(state.data).length === 0 ? (
          <p style={{ color: 'var(--nx-color-muted-foreground)' }}>{t('common.empty')}</p>
        ) : (
          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 24px', fontSize: 14 }}>
            {Object.entries(state.data).map(([key, value]) => (
              <div key={key} style={{ display: 'contents' }}>
                <dt style={{ fontFamily: 'var(--nx-font-mono, monospace)', color: 'var(--nx-color-muted-foreground)' }}>
                  {key}
                </dt>
                <dd style={{ margin: 0 }}>
                  <code>{JSON.stringify(value)}</code>
                </dd>
              </div>
            ))}
          </dl>
        )
      ) : null}
    </>
  );
}
