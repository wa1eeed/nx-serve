'use client';
import { use, type ReactNode } from 'react';
import { apiSend, useApi } from '../../../lib/api';
import { useLocale, useT } from '../../../lib/i18n';
import type { OfferingDetail, OnboardingStatus, ProviderDocumentDetail, ProviderOrgDetail } from '../../../lib/types';
import { ErrorState, Loading, PageHeader } from '../../../components/page-parts';
import { GhostButton, SubmitError, useSubmit } from '../../../components/forms';

export default function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const t = useT();
  const locale = useLocale();

  const detail = useApi<{ org: ProviderOrgDetail; onboarding: OnboardingStatus }>(`/admin/providers/${id}`, locale);
  const offerings = useApi<OfferingDetail[]>(`/admin/providers/${id}/offerings`, locale);
  const documents = useApi<ProviderDocumentDetail[]>(`/admin/providers/${id}/documents`, locale);
  const action = useSubmit();

  const reloadAll = (): void => {
    detail.reload();
    offerings.reload();
    documents.reload();
  };

  const refreshMerchant = (): void =>
    void action.run(async () => {
      await apiSend('POST', `/admin/providers/${id}/merchant/refresh`, undefined, locale);
      detail.reload();
    });

  const reviewOffering = (offeringId: string, decision: 'approve' | 'needs_info' | 'reject'): void => {
    const notes = decision === 'approve' ? undefined : window.prompt(t('providers.notes_ph')) ?? undefined;
    void action.run(async () => {
      await apiSend('POST', `/admin/offerings/${offeringId}/review`, { decision, ...(notes ? { notes } : {}) }, locale);
      reloadAll();
    });
  };

  const reviewDocument = (documentId: string, decision: 'verify' | 'reject'): void =>
    void action.run(async () => {
      await apiSend('POST', `/admin/documents/${documentId}/review`, { decision }, locale);
      reloadAll();
    });

  const org = detail.status === 'ready' ? detail.data.org : undefined;
  const onboarding = detail.status === 'ready' ? detail.data.onboarding : undefined;

  return (
    <>
      <PageHeader title={org ? org.display_name : t('providers.title')} />

      {detail.status === 'loading' ? <Loading /> : null}
      {detail.status === 'error' ? <ErrorState error={detail.error} onRetry={detail.reload} /> : null}
      {action.state.status === 'error' ? (
        <div style={{ marginBottom: 16 }}>
          <SubmitError error={action.state.error} />
        </div>
      ) : null}

      {org && onboarding ? (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={badge}>
              {t('providers.merchant')}: <code>{org.moyasar_status}</code>
            </span>
            <span style={badge}>
              {t('providers.state')}: <strong>{onboarding.state}</strong>
            </span>
            <span style={{ ...badge, borderColor: onboarding.eligible_for_dispatch ? 'var(--nx-color-primary)' : 'var(--nx-color-border)' }}>
              {t('providers.eligible')}: {onboarding.eligible_for_dispatch ? t('providers.yes') : t('providers.no')}
            </span>
            <GhostButton onClick={refreshMerchant}>{t('providers.refresh_merchant')}</GhostButton>
          </div>

          <section style={{ marginBottom: 28 }}>
            <h2 style={h2}>{t('providers.steps')}</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 14 }}>
              {Object.entries(onboarding.steps).map(([step, status]) => (
                <span key={step} style={badge}>
                  {step}: <strong>{status}</strong>
                </span>
              ))}
            </div>
            {onboarding.blockers.length > 0 ? (
              <p style={{ fontSize: 13, color: 'var(--nx-color-muted-foreground)', marginTop: 10 }}>
                {t('providers.blockers')}: {onboarding.blockers.join(', ')}
              </p>
            ) : null}
          </section>

          <Section title={t('providers.offerings')} state={offerings.status}>
            {offerings.status === 'error' ? <ErrorState error={offerings.error} onRetry={offerings.reload} /> : null}
            {offerings.status === 'ready' ? (
              offerings.data.length === 0 ? (
                <Empty text={t('providers.no_offerings')} />
              ) : (
                <table style={table}>
                  <tbody>
                    {offerings.data.map((o) => (
                      <tr key={o.id} style={row}>
                        <td style={cell}>
                          <code>{o.status}</code>
                        </td>
                        <td style={cell}>{JSON.stringify(o.capabilities)}</td>
                        <td style={{ ...cell, textAlign: 'end' }}>
                          <span style={{ display: 'inline-flex', gap: 10 }}>
                            <button type="button" style={link} onClick={() => reviewOffering(o.id, 'approve')}>
                              {t('providers.approve')}
                            </button>
                            <button type="button" style={link} onClick={() => reviewOffering(o.id, 'needs_info')}>
                              {t('providers.needs_info')}
                            </button>
                            <button type="button" style={{ ...link, color: 'var(--nx-color-destructive)' }} onClick={() => reviewOffering(o.id, 'reject')}>
                              {t('providers.reject')}
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : null}
          </Section>

          <Section title={t('providers.documents')} state={documents.status}>
            {documents.status === 'error' ? <ErrorState error={documents.error} onRetry={documents.reload} /> : null}
            {documents.status === 'ready' ? (
              documents.data.length === 0 ? (
                <Empty text={t('providers.no_documents')} />
              ) : (
                <table style={table}>
                  <tbody>
                    {documents.data.map((d) => (
                      <tr key={d.id} style={row}>
                        <td style={cell}>{d.doc_type}</td>
                        <td style={cell}>
                          <code>{d.verify_status}</code>
                        </td>
                        <td style={cell}>{d.expires_on ?? ''}</td>
                        <td style={{ ...cell, textAlign: 'end' }}>
                          <span style={{ display: 'inline-flex', gap: 10 }}>
                            <button type="button" style={link} onClick={() => reviewDocument(d.id, 'verify')}>
                              {t('providers.verify')}
                            </button>
                            <button type="button" style={{ ...link, color: 'var(--nx-color-destructive)' }} onClick={() => reviewDocument(d.id, 'reject')}>
                              {t('providers.reject')}
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : null}
          </Section>
        </>
      ) : null}
    </>
  );
}

function Section({ title, state, children }: { title: string; state: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={h2}>{title}</h2>
      {state === 'loading' ? <Loading /> : children}
    </section>
  );
}

function Empty({ text }: { text: string }): ReactNode {
  return <p style={{ color: 'var(--nx-color-muted-foreground)' }}>{text}</p>;
}

const h2 = { fontSize: 18, margin: '0 0 12px' } as const;
const badge = {
  fontSize: 14,
  border: '1px solid var(--nx-color-border)',
  borderRadius: 'var(--nx-radius-md)',
  padding: '6px 12px',
} as const;
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 14 } as const;
const row = { borderTop: '1px solid var(--nx-color-border)' } as const;
const cell = { padding: '10px' } as const;
const link = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--nx-color-primary)', font: 'inherit' } as const;
