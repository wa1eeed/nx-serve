'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiSend, useApi } from '../../../lib/api';
import { useLocale, useT, type Locale } from '../../../lib/i18n';
import { ErrorState, Loading, PageHeader } from '../../../components/page-parts';
import { GhostButton, PrimaryButton, SubmitError, useSubmit } from '../../../components/forms';

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
  const router = useRouter();
  const state = useApi<VerticalSummary[]>('/catalog/verticals', locale);
  const install = useSubmit();

  const installTowing = (): void => {
    if (!window.confirm(t('install.confirm'))) return;
    void install.run(async () => {
      await apiSend('POST', '/admin/templates/towing/install', undefined, locale);
      window.alert(t('install.done'));
      state.reload();
    });
  };

  return (
    <>
      <PageHeader title={t('verticals.title')} intro={t('verticals.intro')} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <PrimaryButton onClick={() => router.push('/catalog/verticals/new')}>{t('action.new_vertical')}</PrimaryButton>
        <GhostButton onClick={installTowing}>
          {install.state.status === 'pending' ? t('action.installing') : t('action.install_towing')}
        </GhostButton>
      </div>
      {install.state.status === 'error' ? (
        <div style={{ marginBottom: 16 }}>
          <SubmitError error={install.state.error} />
        </div>
      ) : null}

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
                  <td style={cell}>
                    <Link href={`/catalog/verticals/${v.id}`} style={linkStyle}>
                      {localName(v.name, locale)}
                    </Link>
                  </td>
                  <td style={cell}>
                    <code>{v.code}</code>
                  </td>
                  <td style={cell}>{v.is_active ? '●' : '○'}</td>
                  <td style={cell}>
                    <span style={{ display: 'inline-flex', gap: 14 }}>
                      <Link href={`/catalog/verticals/${v.id}`} style={linkStyle}>
                        {t('action.edit')}
                      </Link>
                      <Link href={`/catalog/verticals/${v.id}/form`} style={linkStyle}>
                        {t('verticals.preview')}
                      </Link>
                    </span>
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
