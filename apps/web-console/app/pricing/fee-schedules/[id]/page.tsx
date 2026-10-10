'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiSend, useApi } from '../../../../lib/api';
import { useLocale, useT, type Locale } from '../../../../lib/i18n';
import { ErrorState, Loading, PageHeader } from '../../../../components/page-parts';
import { GhostButton, PrimaryButton, SubmitError, TextInput, useSubmit } from '../../../../components/forms';
import { FeeScheduleForm, type FeeScheduleValues } from '../../../../components/fee-schedule-form';
import { StatusBadge, type PricingStatus } from '../../../../components/pricing-parts';

interface FeeComponentDetail {
  code: string;
  label: Record<string, string>;
  bearer: 'customer' | 'provider' | 'platform';
  calc: 'percent' | 'fixed' | 'percent_plus_fixed';
  rate_pct: number | null;
  fixed_amount_minor: string | null;
  base: 'service_amount' | 'addons' | 'order_total';
  vat_mode: 'exclusive' | 'inclusive' | 'exempt';
  refundable: boolean;
  show_to_customer: boolean;
}
interface FeeScheduleDetail {
  id: string;
  name: Record<string, string>;
  vertical_id: string | null;
  category_id: string | null;
  city_id: string | null;
  zone_id: string | null;
  provider_org_id: string | null;
  gateway_fee_bearer: 'provider' | 'platform';
  priority: number;
  status: PricingStatus;
  version: number;
  created_by: string | null;
  approved_by: string | null;
  components: FeeComponentDetail[];
}

const localName = (name: Record<string, string>, locale: Locale): string => name[locale] ?? name.en ?? '';

function toInitial(d: FeeScheduleDetail): Partial<FeeScheduleValues> {
  return {
    name: { en: d.name.en ?? '', ...(d.name.ar ? { ar: d.name.ar } : {}) },
    vertical_id: d.vertical_id,
    category_id: d.category_id,
    city_id: d.city_id,
    zone_id: d.zone_id,
    provider_org_id: d.provider_org_id,
    gateway_fee_bearer: d.gateway_fee_bearer,
    priority: d.priority,
    components: d.components.map((c) => ({
      code: c.code,
      label: { en: c.label.en ?? '', ...(c.label.ar ? { ar: c.label.ar } : {}) },
      bearer: c.bearer,
      calc: c.calc,
      rate_pct: c.rate_pct,
      fixed_amount_minor: c.fixed_amount_minor,
      base: c.base,
      vat_mode: c.vat_mode,
      refundable: c.refundable,
      show_to_customer: c.show_to_customer,
    })),
  };
}

export default function FeeScheduleDetailPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const state = useApi<FeeScheduleDetail>(`/admin/pricing/fee-schedules/${id}`, locale);
  const edit = useSubmit();
  const action = useSubmit();
  const [notes, setNotes] = useState('');

  const base = `/admin/pricing/fee-schedules/${id}`;
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
      <PageHeader title={t('fs.title')} />
      <p style={{ marginTop: -14, marginBottom: 18 }}>
        <Link href="/pricing/fee-schedules" style={{ color: 'var(--nx-color-primary)' }}>
          ← {t('fs.title')}
        </Link>
      </p>

      {state.status === 'loading' ? <Loading /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {state.status === 'ready' ? (
        <>
          <div style={summary}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{localName(state.data.name, locale)}</strong>
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
            <FeeScheduleForm initial={toInitial(state.data)} submit={patch} submitState={edit.state} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, maxWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: 'start', color: 'var(--nx-color-muted-foreground)' }}>
                  <th style={{ padding: '8px 10px' }}>{t('fs.component_code')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('fs.bearer')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('fs.calc')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('fs.vat_mode')}</th>
                </tr>
              </thead>
              <tbody>
                {state.data.components.map((c) => (
                  <tr key={c.code} style={{ borderTop: '1px solid var(--nx-color-border)' }}>
                    <td style={{ padding: 10 }}>
                      <code>{c.code}</code>
                    </td>
                    <td style={{ padding: 10 }}>{c.bearer}</td>
                    <td style={{ padding: 10 }}>
                      {c.calc} {c.rate_pct != null ? `${c.rate_pct}%` : ''}
                    </td>
                    <td style={{ padding: 10 }}>{c.vat_mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
