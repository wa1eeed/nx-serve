'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiSend, useApi } from '../../../../lib/api';
import { useLocale, useT } from '../../../../lib/i18n';
import { ErrorState, Loading, PageHeader } from '../../../../components/page-parts';
import { GhostButton, PrimaryButton, SubmitError, TextInput, useSubmit } from '../../../../components/forms';
import { RateCardForm, type RateCardValues } from '../../../../components/rate-card-form';
import { StatusBadge, formatSar, type PricingStatus } from '../../../../components/pricing-parts';

interface RateCardDetail extends RateCardValues {
  id: string;
  currency: string;
  status: PricingStatus;
  version: number;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

export default function RateCardDetailPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const state = useApi<RateCardDetail>(`/admin/pricing/rate-cards/${id}`, locale);
  const edit = useSubmit();
  const action = useSubmit();
  const [notes, setNotes] = useState('');

  const base = `/admin/pricing/rate-cards/${id}`;
  const patch = (body: Record<string, unknown>): void => {
    void edit.run(async () => {
      await apiSend('PATCH', base, body, locale);
      state.reload();
    });
  };
  const lifecycle = (verb: string, withNotes = false): void => {
    void action.run(async () => {
      await apiSend('POST', `${base}/${verb}`, withNotes ? { notes: notes || undefined } : {}, locale);
      setNotes('');
      state.reload();
    });
  };

  return (
    <>
      <PageHeader title={t('rc.title')} />
      <p style={{ marginTop: -14, marginBottom: 18 }}>
        <Link href="/pricing/rate-cards" style={{ color: 'var(--nx-color-primary)' }}>
          ← {t('rc.title')}
        </Link>
      </p>

      {state.status === 'loading' ? <Loading /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {state.status === 'ready' ? (
        <>
          <div style={summary}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={state.data.status} />
              <span style={meta}>
                {t('lc.version')} {state.data.version}
              </span>
              {state.data.created_by ? (
                <span style={meta}>
                  {t('lc.created_by')} <code>{state.data.created_by.slice(0, 8)}</code>
                </span>
              ) : null}
              {state.data.approved_by ? (
                <span style={meta}>
                  {t('lc.approved_by')} <code>{state.data.approved_by.slice(0, 8)}</code>
                </span>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {state.data.status === 'draft' ? <PrimaryButton onClick={() => lifecycle('submit')}>{t('lc.submit')}</PrimaryButton> : null}
              {state.data.status === 'pending_approval' ? (
                <>
                  <TextInput value={notes} onChange={setNotes} placeholder={t('lc.notes')} />
                  <PrimaryButton onClick={() => lifecycle('approve', true)}>{t('lc.approve')}</PrimaryButton>
                  <GhostButton onClick={() => lifecycle('reject', true)}>{t('lc.reject')}</GhostButton>
                </>
              ) : null}
              {state.data.status !== 'archived' ? <GhostButton onClick={() => lifecycle('archive')}>{t('lc.archive')}</GhostButton> : null}
            </div>
            {action.state.status === 'error' ? (
              <div style={{ marginTop: 12 }}>
                <SubmitError error={action.state.error} />
              </div>
            ) : null}
          </div>

          {state.data.status === 'draft' || state.data.status === 'pending_approval' ? (
            <RateCardForm initial={state.data} submit={patch} submitState={edit.state} />
          ) : (
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 18px', maxWidth: 420 }}>
              <dt style={meta}>{t('rc.base_fare')}</dt>
              <dd style={{ margin: 0 }}>{formatSar(state.data.base_fare_minor, locale)}</dd>
              <dt style={meta}>{t('rc.min_fare')}</dt>
              <dd style={{ margin: 0 }}>{formatSar(state.data.minimum_fare_minor, locale)}</dd>
              <dt style={meta}>{t('rc.class_mult')}</dt>
              <dd style={{ margin: 0 }}>{state.data.class_multiplier}</dd>
              <dt style={meta}>{t('rc.auth_buffer')}</dt>
              <dd style={{ margin: 0 }}>{state.data.auth_buffer_pct}%</dd>
            </dl>
          )}
        </>
      ) : null}
    </>
  );
}

const summary = {
  border: '1px solid var(--nx-color-border)',
  borderRadius: 'var(--nx-radius-lg)',
  background: 'var(--nx-color-card)',
  padding: 18,
  marginBottom: 22,
} as const;
const meta = { color: 'var(--nx-color-muted-foreground)', fontSize: 13 } as const;
