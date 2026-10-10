'use client';
import { useState, type ReactNode } from 'react';
import { useT } from '../lib/i18n';
import { CheckboxInput, Field, GhostButton, PrimaryButton, SelectInput, SubmitError, TextInput, type SubmitState } from './forms';
import { toMinor } from './pricing-parts';

export interface FeeComponentValues {
  code: string;
  label: { en: string; ar?: string };
  bearer: 'customer' | 'provider' | 'platform';
  calc: 'percent' | 'fixed' | 'percent_plus_fixed';
  rate_pct: number | null;
  fixed_amount_minor: string | null;
  base: 'service_amount' | 'addons' | 'order_total';
  vat_mode: 'exclusive' | 'inclusive' | 'exempt';
  refundable: boolean;
  show_to_customer: boolean;
}

export interface FeeScheduleValues {
  name: { en: string; ar?: string };
  vertical_id: string | null;
  category_id: string | null;
  city_id: string | null;
  zone_id: string | null;
  provider_org_id: string | null;
  gateway_fee_bearer: 'provider' | 'platform';
  priority: number;
  components: FeeComponentValues[];
}

interface RowState {
  code: string;
  label_en: string;
  label_ar: string;
  bearer: string;
  calc: string;
  rate_pct: string;
  fixed: string;
  base: string;
  vat_mode: string;
  refundable: boolean;
  show_to_customer: boolean;
}

function toRow(c?: FeeComponentValues): RowState {
  return {
    code: c?.code ?? '',
    label_en: c?.label.en ?? '',
    label_ar: c?.label.ar ?? '',
    bearer: c?.bearer ?? 'provider',
    calc: c?.calc ?? 'percent',
    rate_pct: c?.rate_pct != null ? String(c.rate_pct) : '',
    fixed: c?.fixed_amount_minor != null ? String(Number(c.fixed_amount_minor) / 100) : '',
    base: c?.base ?? 'service_amount',
    vat_mode: c?.vat_mode ?? 'exclusive',
    refundable: c?.refundable ?? true,
    show_to_customer: c?.show_to_customer ?? true,
  };
}

function rowToComponent(r: RowState): Record<string, unknown> {
  const isPercent = r.calc === 'percent' || r.calc === 'percent_plus_fixed';
  const isFixed = r.calc === 'fixed' || r.calc === 'percent_plus_fixed';
  return {
    code: r.code.trim(),
    label: { en: r.label_en, ...(r.label_ar ? { ar: r.label_ar } : {}) },
    bearer: r.bearer,
    calc: r.calc,
    ...(isPercent ? { rate_pct: Math.max(0, Number(r.rate_pct) || 0) } : {}),
    ...(isFixed ? { fixed_amount_minor: toMinor(r.fixed) } : {}),
    base: r.base,
    vat_mode: r.vat_mode,
    refundable: r.refundable,
    show_to_customer: r.show_to_customer,
  };
}

const opts = (xs: string[]): { value: string; label: string }[] => xs.map((x) => ({ value: x, label: x }));

export function FeeScheduleForm({
  initial,
  submit,
  submitState,
}: {
  initial?: Partial<FeeScheduleValues>;
  submit: (body: Record<string, unknown>) => void;
  submitState: SubmitState;
}): ReactNode {
  const t = useT();
  const [nameEn, setNameEn] = useState(initial?.name?.en ?? '');
  const [nameAr, setNameAr] = useState(initial?.name?.ar ?? '');
  const [scope, setScope] = useState({
    vertical_id: initial?.vertical_id ?? '',
    category_id: initial?.category_id ?? '',
    city_id: initial?.city_id ?? '',
    zone_id: initial?.zone_id ?? '',
    provider_org_id: initial?.provider_org_id ?? '',
  });
  const [gatewayBearer, setGatewayBearer] = useState(initial?.gateway_fee_bearer ?? 'platform');
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));
  const [rows, setRows] = useState<RowState[]>(() => (initial?.components ?? []).map(toRow));

  const setScopeKey = (k: keyof typeof scope, v: string): void => setScope((p) => ({ ...p, [k]: v }));
  const setRow = (i: number, patch: Partial<RowState>): void => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = (): void => setRows((rs) => [...rs, toRow()]);
  const removeRow = (i: number): void => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const nullable = (v: string): string | null => (v.trim() ? v.trim() : null);

  const onSubmit = (): void => {
    submit({
      name: { en: nameEn, ...(nameAr ? { ar: nameAr } : {}) },
      vertical_id: nullable(scope.vertical_id),
      category_id: nullable(scope.category_id),
      city_id: nullable(scope.city_id),
      zone_id: nullable(scope.zone_id),
      provider_org_id: nullable(scope.provider_org_id),
      currency: 'SAR',
      gateway_fee_bearer: gatewayBearer,
      priority: Number(priority),
      components: rows.map(rowToComponent),
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 680 }}
    >
      <Row>
        <Field label={`${t('fs.name')} (EN)`} required>
          <TextInput required value={nameEn} onChange={setNameEn} />
        </Field>
        <Field label={`${t('fs.name')} (ع)`}>
          <TextInput value={nameAr} onChange={setNameAr} />
        </Field>
      </Row>
      <Row>
        <Field label={t('fs.gateway_bearer')}>
          <SelectInput value={gatewayBearer} onChange={(v) => setGatewayBearer(v as 'provider' | 'platform')} options={opts(['platform', 'provider'])} />
        </Field>
        <Field label={t('fs.priority')}>
          <TextInput type="number" value={priority} onChange={setPriority} />
        </Field>
      </Row>

      <h2 style={h2}>{t('rc.scope')}</h2>
      <Row>
        <Field label={t('rc.city_id')}>
          <TextInput value={scope.city_id} onChange={(v) => setScopeKey('city_id', v)} />
        </Field>
        <Field label={t('rc.zone_id')}>
          <TextInput value={scope.zone_id} onChange={(v) => setScopeKey('zone_id', v)} />
        </Field>
      </Row>

      <h2 style={h2}>{t('fs.components')}</h2>
      {rows.length === 0 ? <p style={{ color: 'var(--nx-color-muted-foreground)', fontSize: 14 }}>{t('fs.no_components')}</p> : null}
      {rows.map((r, i) => (
        <div key={i} style={componentCard}>
          <Row>
            <Field label={t('fs.component_code')} required>
              <TextInput required value={r.code} onChange={(v) => setRow(i, { code: v })} />
            </Field>
            <Field label={`${t('fs.component_label')} (EN)`} required>
              <TextInput required value={r.label_en} onChange={(v) => setRow(i, { label_en: v })} />
            </Field>
          </Row>
          <Row>
            <Field label={t('fs.bearer')}>
              <SelectInput value={r.bearer} onChange={(v) => setRow(i, { bearer: v })} options={opts(['provider', 'customer', 'platform'])} />
            </Field>
            <Field label={t('fs.calc')}>
              <SelectInput value={r.calc} onChange={(v) => setRow(i, { calc: v })} options={opts(['percent', 'fixed', 'percent_plus_fixed'])} />
            </Field>
          </Row>
          <Row>
            {r.calc !== 'fixed' ? (
              <Field label={t('fs.rate_pct')}>
                <TextInput type="number" min={0} value={r.rate_pct} onChange={(v) => setRow(i, { rate_pct: v })} />
              </Field>
            ) : (
              <span />
            )}
            {r.calc !== 'percent' ? (
              <Field label={t('fs.fixed_amount')}>
                <TextInput type="number" min={0} value={r.fixed} onChange={(v) => setRow(i, { fixed: v })} />
              </Field>
            ) : (
              <span />
            )}
          </Row>
          <Row>
            <Field label={t('fs.base')}>
              <SelectInput value={r.base} onChange={(v) => setRow(i, { base: v })} options={opts(['service_amount', 'addons', 'order_total'])} />
            </Field>
            <Field label={t('fs.vat_mode')}>
              <SelectInput value={r.vat_mode} onChange={(v) => setRow(i, { vat_mode: v })} options={opts(['exclusive', 'inclusive', 'exempt'])} />
            </Field>
          </Row>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <CheckboxInput label={t('fs.show_to_customer')} value={r.show_to_customer} onChange={(v) => setRow(i, { show_to_customer: v })} />
            <GhostButton onClick={() => removeRow(i)}>{t('fs.remove')}</GhostButton>
          </div>
        </div>
      ))}
      <div>
        <GhostButton onClick={addRow}>{t('fs.add_component')}</GhostButton>
      </div>

      {submitState.status === 'error' ? <SubmitError error={submitState.error} /> : null}
      <div>
        <PrimaryButton type="submit" disabled={submitState.status === 'pending'}>
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
const componentCard = {
  border: '1px solid var(--nx-color-border)',
  borderRadius: 'var(--nx-radius-md)',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
} as const;
