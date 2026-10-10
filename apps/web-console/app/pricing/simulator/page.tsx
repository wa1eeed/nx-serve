'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { apiSend } from '../../../lib/api';
import { useLocale, useT, type Locale } from '../../../lib/i18n';
import { PageHeader } from '../../../components/page-parts';
import { Field, PrimaryButton, SelectInput, SubmitError, TextInput } from '../../../components/forms';

interface SplitLine {
  recipient_type: string;
  recipient_ref: string;
  amount_minor: string;
  is_fee_source: boolean;
}
interface SimResult {
  currency: string;
  service_fare_minor: string;
  customer_total_minor: string;
  authorized_minor: string;
  fee_lines: { code: string; bearer: string; amount_minor: string; vat_minor: string }[];
  splits: SplitLine[];
  settlement: { provider_net_minor: string; platform_net_minor: string; gateway_fee_minor: string };
}

const sar = (locale: Locale) =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 });
const toMinor = (sarValue: string): string => String(Math.round((Number(sarValue) || 0) * 100));

export default function SimulatorPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const money = useMemo(() => sar(locale), [locale]);
  const fmt = (minor: string): string => money.format(Number(minor) / 100);

  const [f, setF] = useState({
    base_fare: '80',
    included_km: '5',
    per_km: '4',
    per_min: '0.5',
    class_multiplier: '1.3',
    min_fare: '50',
    auth_buffer_pct: '15',
    distance_km: '22',
    duration_min: '30',
    surge: '1.2',
    commission_pct: '10',
    fee_bearer: 'provider',
    gateway_pct: '0.85',
    fee_source: 'provider',
  });
  const set = (k: keyof typeof f, v: string): void => setF((prev) => ({ ...prev, [k]: v }));

  const [result, setResult] = useState<SimResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);

  const compute = async (): Promise<void> => {
    setStatus('pending');
    try {
      const body = {
        rate_card: {
          currency: 'SAR',
          base_fare_minor: toMinor(f.base_fare),
          included_km: Number(f.included_km),
          per_km: Number(f.per_km),
          per_min: Number(f.per_min),
          minimum_fare_minor: toMinor(f.min_fare),
          class_multiplier: Number(f.class_multiplier),
          auth_buffer_pct: Number(f.auth_buffer_pct),
          rounding: 'nearest_1',
        },
        fee_components: [
          { code: 'platform_commission', bearer: f.fee_bearer, calc: 'percent', rate_pct: Number(f.commission_pct), base: 'service_amount', vat_mode: 'inclusive' },
        ],
        trip: { distance_km: Number(f.distance_km), duration_min: Number(f.duration_min) },
        surge_multiplier: Number(f.surge),
        gateway: { rate_pct: Number(f.gateway_pct), fixed_amount_minor: '0', vat_pct: 15 },
        fee_source: f.fee_source,
      };
      const res = await apiSend<SimResult>('POST', '/admin/pricing/simulate', body, locale);
      setResult(res);
      setStatus('idle');
    } catch (e) {
      setError(e as Error);
      setStatus('error');
    }
  };

  return (
    <>
      <PageHeader title={t('sim.title')} intro={t('sim.intro')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void compute();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <h2 style={h2}>{t('sim.rate_card')}</h2>
          <Row>
            <Field label={t('sim.base_fare')}><TextInput type="number" value={f.base_fare} onChange={(v) => set('base_fare', v)} /></Field>
            <Field label={t('sim.included_km')}><TextInput type="number" value={f.included_km} onChange={(v) => set('included_km', v)} /></Field>
          </Row>
          <Row>
            <Field label={t('sim.per_km')}><TextInput type="number" value={f.per_km} onChange={(v) => set('per_km', v)} /></Field>
            <Field label={t('sim.per_min')}><TextInput type="number" value={f.per_min} onChange={(v) => set('per_min', v)} /></Field>
          </Row>
          <Row>
            <Field label={t('sim.class_mult')}><TextInput type="number" value={f.class_multiplier} onChange={(v) => set('class_multiplier', v)} /></Field>
            <Field label={t('sim.min_fare')}><TextInput type="number" value={f.min_fare} onChange={(v) => set('min_fare', v)} /></Field>
          </Row>
          <Field label={t('sim.auth_buffer')}><TextInput type="number" value={f.auth_buffer_pct} onChange={(v) => set('auth_buffer_pct', v)} /></Field>

          <h2 style={h2}>{t('sim.trip')}</h2>
          <Row>
            <Field label={t('sim.distance_km')}><TextInput type="number" value={f.distance_km} onChange={(v) => set('distance_km', v)} /></Field>
            <Field label={t('sim.duration_min')}><TextInput type="number" value={f.duration_min} onChange={(v) => set('duration_min', v)} /></Field>
          </Row>
          <Field label={t('sim.surge')}><TextInput type="number" value={f.surge} onChange={(v) => set('surge', v)} /></Field>

          <h2 style={h2}>{t('sim.fee')}</h2>
          <Row>
            <Field label={t('sim.fee')}><TextInput type="number" value={f.commission_pct} onChange={(v) => set('commission_pct', v)} /></Field>
            <Field label={t('sim.fee_bearer')}>
              <SelectInput value={f.fee_bearer} onChange={(v) => set('fee_bearer', v)} options={['provider', 'customer', 'platform'].map((x) => ({ value: x, label: x }))} />
            </Field>
          </Row>
          <Row>
            <Field label={t('sim.gateway')}><TextInput type="number" value={f.gateway_pct} onChange={(v) => set('gateway_pct', v)} /></Field>
            <Field label={t('sim.fee_source')}>
              <SelectInput value={f.fee_source} onChange={(v) => set('fee_source', v)} options={['provider', 'platform'].map((x) => ({ value: x, label: x }))} />
            </Field>
          </Row>

          {status === 'error' && error ? <SubmitError error={error} /> : null}
          <PrimaryButton type="submit" disabled={status === 'pending'}>{t('sim.compute')}</PrimaryButton>
        </form>

        {result ? (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Line label={t('sim.service_fare')} value={fmt(result.service_fare_minor)} />
            <Line label={t('sim.customer_total')} value={fmt(result.customer_total_minor)} emphasis />
            <Line label={t('sim.authorized')} value={fmt(result.authorized_minor)} />
            <h3 style={{ fontSize: 15, margin: '6px 0 0' }}>{t('sim.splits')}</h3>
            {result.splits.map((s) => (
              <Line key={s.recipient_type} label={`${s.recipient_type}${s.is_fee_source ? ' ★' : ''}`} value={fmt(s.amount_minor)} />
            ))}
            <h3 style={{ fontSize: 15, margin: '6px 0 0' }}>{t('sim.settlement')}</h3>
            <Line label={t('sim.provider_net')} value={fmt(result.settlement.provider_net_minor)} />
            <Line label={t('sim.platform_net')} value={fmt(result.settlement.platform_net_minor)} />
            <Line label={t('sim.gateway_fee')} value={fmt(result.settlement.gateway_fee_minor)} />
          </div>
        ) : null}
      </div>
    </>
  );
}

function Row({ children }: { children: ReactNode }): ReactNode {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>;
}
function Line({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }): ReactNode {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: emphasis ? 18 : 14, fontWeight: emphasis ? 700 : 400 }}>
      <span style={{ color: 'var(--nx-color-muted-foreground)' }}>{label}</span>
      <span style={emphasis ? { color: 'var(--nx-color-primary)' } : undefined}>{value}</span>
    </div>
  );
}

const h2 = { fontSize: 16, margin: '8px 0 0' } as const;
const card = { border: '1px solid var(--nx-color-border)', borderRadius: 'var(--nx-radius-lg)', background: 'var(--nx-color-card)', padding: 22 } as const;
