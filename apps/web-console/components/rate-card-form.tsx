'use client';
import { useState, type ReactNode } from 'react';
import { useT } from '../lib/i18n';
import { Field, PrimaryButton, SelectInput, SubmitError, TextInput, type SubmitState } from './forms';
import { fromMinor, toMinor } from './pricing-parts';

/** The subset of a rate card the form edits (money as minor strings, rates as numbers). */
export interface RateCardValues {
  tier_id: string;
  city_id: string;
  zone_id: string | null;
  vehicle_class_id: string | null;
  base_fare_minor: string;
  booking_fee_minor: string;
  flat_fare_minor: string | null;
  included_km: number;
  per_km: number;
  approach_per_km: number;
  approach_free_km: number;
  per_min: number;
  free_wait_min: number;
  per_wait_min: number;
  minimum_fare_minor: string;
  maximum_fare_minor: string | null;
  class_multiplier: number;
  extra_stop_fee_minor: string;
  auth_buffer_pct: number;
  reprice_threshold_pct: number;
  rounding: 'none' | 'nearest_0_5' | 'nearest_1' | 'up_5';
  cancellation_fee_minor: string;
  cancellation_free_min: number;
}

// Form state is all strings (what inputs hold); converted on submit.
type FormState = Record<string, string>;

function initialState(v?: Partial<RateCardValues>): FormState {
  return {
    tier_id: v?.tier_id ?? '',
    city_id: v?.city_id ?? '',
    zone_id: v?.zone_id ?? '',
    vehicle_class_id: v?.vehicle_class_id ?? '',
    base_fare: fromMinor(v?.base_fare_minor) || '0',
    booking_fee: fromMinor(v?.booking_fee_minor) || '0',
    flat_fare: fromMinor(v?.flat_fare_minor),
    included_km: String(v?.included_km ?? 0),
    per_km: String(v?.per_km ?? 0),
    approach_per_km: String(v?.approach_per_km ?? 0),
    approach_free_km: String(v?.approach_free_km ?? 0),
    per_min: String(v?.per_min ?? 0),
    free_wait_min: String(v?.free_wait_min ?? 0),
    per_wait_min: String(v?.per_wait_min ?? 0),
    min_fare: fromMinor(v?.minimum_fare_minor) || '0',
    max_fare: fromMinor(v?.maximum_fare_minor),
    class_multiplier: String(v?.class_multiplier ?? 1),
    extra_stop_fee: fromMinor(v?.extra_stop_fee_minor) || '0',
    auth_buffer_pct: String(v?.auth_buffer_pct ?? 15),
    reprice_threshold_pct: String(v?.reprice_threshold_pct ?? 20),
    rounding: v?.rounding ?? 'nearest_1',
    cancellation_fee: fromMinor(v?.cancellation_fee_minor) || '0',
    cancellation_free_min: String(v?.cancellation_free_min ?? 2),
  };
}

/** Builds the create/update request body (snake_case) the API contract expects. */
function toBody(f: FormState): Record<string, unknown> {
  return {
    tier_id: f.tier_id.trim(),
    city_id: f.city_id.trim(),
    ...(f.zone_id?.trim() ? { zone_id: f.zone_id.trim() } : { zone_id: null }),
    ...(f.vehicle_class_id?.trim() ? { vehicle_class_id: f.vehicle_class_id.trim() } : { vehicle_class_id: null }),
    currency: 'SAR',
    base_fare_minor: toMinor(f.base_fare ?? '0'),
    booking_fee_minor: toMinor(f.booking_fee ?? '0'),
    ...(f.flat_fare?.trim() ? { flat_fare_minor: toMinor(f.flat_fare) } : { flat_fare_minor: null }),
    included_km: Number(f.included_km),
    per_km: Number(f.per_km),
    approach_per_km: Number(f.approach_per_km),
    approach_free_km: Number(f.approach_free_km),
    per_min: Number(f.per_min),
    free_wait_min: Number(f.free_wait_min),
    per_wait_min: Number(f.per_wait_min),
    minimum_fare_minor: toMinor(f.min_fare ?? '0'),
    ...(f.max_fare?.trim() ? { maximum_fare_minor: toMinor(f.max_fare) } : { maximum_fare_minor: null }),
    // class_multiplier must be positive; an empty field falls back to 1, not 0.
    class_multiplier: Number(f.class_multiplier) || 1,
    extra_stop_fee_minor: toMinor(f.extra_stop_fee ?? '0'),
    auth_buffer_pct: Number(f.auth_buffer_pct),
    reprice_threshold_pct: Number(f.reprice_threshold_pct),
    rounding: f.rounding,
    cancellation_fee_minor: toMinor(f.cancellation_fee ?? '0'),
    cancellation_free_min: Number(f.cancellation_free_min),
  };
}

export function RateCardForm({
  initial,
  submit,
  submitState,
  disabled,
}: {
  initial?: Partial<RateCardValues>;
  submit: (body: Record<string, unknown>) => void;
  submitState: SubmitState;
  disabled?: boolean;
}): ReactNode {
  const t = useT();
  const [f, setF] = useState<FormState>(() => initialState(initial));
  const set = (k: string, v: string): void => setF((prev) => ({ ...prev, [k]: v }));
  const num = (k: string, label: string): ReactNode => (
    <Field label={label}>
      <TextInput type="number" min={0} value={f[k] ?? ''} onChange={(v) => set(k, v)} />
    </Field>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(toBody(f));
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}
    >
      <h2 style={h2}>{t('rc.scope')}</h2>
      <Row>
        <Field label={t('rc.tier_id')} required>
          <TextInput required value={f.tier_id ?? ''} onChange={(v) => set('tier_id', v)} />
        </Field>
        <Field label={t('rc.city_id')} required>
          <TextInput required value={f.city_id ?? ''} onChange={(v) => set('city_id', v)} />
        </Field>
      </Row>
      <Row>
        <Field label={t('rc.zone_id')}>
          <TextInput value={f.zone_id ?? ''} onChange={(v) => set('zone_id', v)} />
        </Field>
        <Field label={t('rc.vehicle_class_id')}>
          <TextInput value={f.vehicle_class_id ?? ''} onChange={(v) => set('vehicle_class_id', v)} />
        </Field>
      </Row>

      <h2 style={h2}>{t('rc.fare')}</h2>
      <Row>
        {num('base_fare', t('rc.base_fare'))}
        {num('booking_fee', t('rc.booking_fee'))}
      </Row>
      <Row>
        {num('included_km', t('rc.included_km'))}
        {num('per_km', t('rc.per_km'))}
      </Row>
      <Row>
        {num('per_min', t('rc.per_min'))}
        {num('class_multiplier', t('rc.class_mult'))}
      </Row>
      <Row>
        {num('approach_per_km', t('rc.approach_per_km'))}
        {num('approach_free_km', t('rc.approach_free_km'))}
      </Row>
      <Row>
        {num('free_wait_min', t('rc.free_wait_min'))}
        {num('per_wait_min', t('rc.per_wait_min'))}
      </Row>
      <Row>
        {num('min_fare', t('rc.min_fare'))}
        {num('max_fare', t('rc.max_fare'))}
      </Row>
      <Row>
        {num('flat_fare', t('rc.flat_fare'))}
        {num('extra_stop_fee', t('rc.extra_stop_fee'))}
      </Row>

      <h2 style={h2}>{t('rc.controls')}</h2>
      <Row>
        {num('auth_buffer_pct', t('rc.auth_buffer'))}
        {num('reprice_threshold_pct', t('rc.reprice_threshold'))}
      </Row>
      <Field label={t('rc.rounding')}>
        <SelectInput
          value={f.rounding ?? 'nearest_1'}
          onChange={(v) => set('rounding', v)}
          options={['none', 'nearest_0_5', 'nearest_1', 'up_5'].map((x) => ({ value: x, label: x }))}
        />
      </Field>
      <Row>
        {num('cancellation_fee', t('rc.cancellation_fee'))}
        {num('cancellation_free_min', t('rc.cancellation_free_min'))}
      </Row>

      {submitState.status === 'error' ? <SubmitError error={submitState.error} /> : null}
      <div>
        <PrimaryButton type="submit" disabled={disabled || submitState.status === 'pending'}>
          {submitState.status === 'pending' ? t('action.saving') : t('action.save')}
        </PrimaryButton>
      </div>
    </form>
  );
}

function Row({ children }: { children: ReactNode }): ReactNode {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>;
}
const h2 = { fontSize: 16, margin: '8px 0 0' } as const;
