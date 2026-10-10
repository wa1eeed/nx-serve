'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiSend } from '../lib/api';
import { useLocale, useT } from '../lib/i18n';
import type { FieldDetail } from '../lib/types';
import {
  CheckboxInput,
  Field,
  GhostButton,
  PrimaryButton,
  SelectInput,
  SubmitError,
  TextInput,
  useSubmit,
} from './forms';

const FIELD_TYPES = [
  'text', 'number', 'boolean', 'single_select', 'multi_select',
  'date', 'location', 'media', 'item_list', 'reference',
];
const SCOPES = ['order', 'provider_capability', 'asset'];
const VIS_OPS = ['eq', 'ne', 'in'] as const;

interface OptionDraft {
  value: string;
  labelEn: string;
  labelAr: string;
}

/** Coerces a visibility value so equality matches the controlling field's real type. */
function coerce(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

interface ShowIf {
  key: string;
  eq?: unknown;
  ne?: unknown;
  in?: unknown[];
}

function readShowIf(rule: Record<string, unknown> | null | undefined): {
  key: string;
  op: (typeof VIS_OPS)[number];
  value: string;
} {
  const showIf = (rule?.show_if ?? undefined) as ShowIf | undefined;
  if (!showIf) return { key: '', op: 'eq', value: '' };
  if (Array.isArray(showIf.in)) return { key: showIf.key, op: 'in', value: showIf.in.join(',') };
  if ('ne' in showIf) return { key: showIf.key, op: 'ne', value: String(showIf.ne) };
  return { key: showIf.key, op: 'eq', value: String(showIf.eq ?? '') };
}

export function FieldForm({ verticalId, initial }: { verticalId: string; initial?: FieldDetail }): ReactNode {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { state, run } = useSubmit();
  const editing = Boolean(initial);
  const vis = readShowIf(initial?.visibility_rule);

  const [key, setKey] = useState(initial?.key ?? '');
  const [dataType, setDataType] = useState(initial?.data_type ?? 'text');
  const [labelEn, setLabelEn] = useState(initial?.label.en ?? '');
  const [labelAr, setLabelAr] = useState(initial?.label.ar ?? '');
  const [required, setRequired] = useState(initial?.required ?? false);
  const [scope, setScope] = useState(initial?.scope ?? 'order');
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));
  const [referenceSource, setReferenceSource] = useState(initial?.reference_source ?? '');
  const [options, setOptions] = useState<OptionDraft[]>(
    initial?.options?.map((o) => ({ value: o.value, labelEn: o.label.en, labelAr: o.label.ar ?? '' })) ?? [],
  );
  const [visKey, setVisKey] = useState(vis.key);
  const [visOp, setVisOp] = useState<string>(vis.op);
  const [visValue, setVisValue] = useState(vis.value);

  const hasOptions = dataType === 'single_select' || dataType === 'multi_select';
  const isReference = dataType === 'reference';

  const setOption = (i: number, patch: Partial<OptionDraft>): void =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const submit = (): void => {
    void run(async () => {
      const label: Record<string, string> = { en: labelEn };
      if (labelAr.trim()) label.ar = labelAr.trim();

      const body: Record<string, unknown> = {
        key,
        data_type: dataType,
        label,
        required,
        sort_order: Number(sortOrder) || 0,
      };
      if (!editing) body.scope = scope; // scope is immutable after create
      body.options =
        hasOptions && options.length > 0
          ? options.map((o) => {
              const optLabel: Record<string, string> = { en: o.labelEn };
              if (o.labelAr.trim()) optLabel.ar = o.labelAr.trim();
              return { value: o.value, label: optLabel };
            })
          : undefined;
      body.reference_source = isReference && referenceSource.trim() ? referenceSource.trim() : undefined;
      // Visibility is stored wrapped in show_if, which the form schema builder reads.
      body.visibility_rule = visKey.trim()
        ? {
            show_if:
              visOp === 'in'
                ? { key: visKey.trim(), in: visValue.split(',').map((s) => coerce(s.trim())) }
                : { key: visKey.trim(), [visOp]: coerce(visValue) },
          }
        : undefined;

      if (editing && initial) {
        await apiSend('PATCH', `/admin/fields/${initial.id}`, body, locale);
      } else {
        await apiSend('POST', `/admin/verticals/${verticalId}/fields`, body, locale);
      }
      router.push(`/catalog/verticals/${verticalId}`);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}
    >
      <Field label={t('field.key')} required>
        <TextInput value={key} onChange={setKey} placeholder="is_basement" />
      </Field>
      <Field label={t('field.data_type')} required>
        <SelectInput value={dataType} onChange={setDataType} options={FIELD_TYPES.map((v) => ({ value: v, label: v }))} />
      </Field>
      <Field label={t('field.label_en')} required>
        <TextInput value={labelEn} onChange={setLabelEn} />
      </Field>
      <Field label={t('field.label_ar')}>
        <TextInput value={labelAr} onChange={setLabelAr} />
      </Field>
      <CheckboxInput label={t('field.required')} value={required} onChange={setRequired} />
      {!editing ? (
        <Field label={t('field.scope')}>
          <SelectInput value={scope} onChange={setScope} options={SCOPES.map((v) => ({ value: v, label: v }))} />
        </Field>
      ) : null}
      <Field label={t('field.sort_order')}>
        <TextInput type="number" value={sortOrder} onChange={setSortOrder} />
      </Field>

      {isReference ? (
        <Field label={t('field.reference_source')}>
          <TextInput value={referenceSource} onChange={setReferenceSource} placeholder="provider_branch" />
        </Field>
      ) : null}

      {hasOptions ? (
        <fieldset style={{ border: '1px solid var(--nx-color-border)', borderRadius: 'var(--nx-radius-md)', padding: 14 }}>
          <legend style={{ fontSize: 14, padding: '0 6px' }}>{t('field.options')}</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {options.map((o, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <Field label={t('field.option_value')}>
                  <TextInput value={o.value} onChange={(v) => setOption(i, { value: v })} />
                </Field>
                <Field label={t('field.label_en')}>
                  <TextInput value={o.labelEn} onChange={(v) => setOption(i, { labelEn: v })} />
                </Field>
                <Field label={t('field.label_ar')}>
                  <TextInput value={o.labelAr} onChange={(v) => setOption(i, { labelAr: v })} />
                </Field>
                <GhostButton onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}>
                  {t('field.remove')}
                </GhostButton>
              </div>
            ))}
            <div>
              <GhostButton onClick={() => setOptions((prev) => [...prev, { value: '', labelEn: '', labelAr: '' }])}>
                {t('field.add_option')}
              </GhostButton>
            </div>
          </div>
        </fieldset>
      ) : null}

      <fieldset style={{ border: '1px solid var(--nx-color-border)', borderRadius: 'var(--nx-radius-md)', padding: 14 }}>
        <legend style={{ fontSize: 14, padding: '0 6px' }}>{t('field.visibility')}</legend>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 8 }}>
          <Field label={t('field.visibility_key')}>
            <TextInput value={visKey} onChange={setVisKey} placeholder="is_basement" />
          </Field>
          <Field label={t('field.visibility_op')}>
            <SelectInput value={visOp} onChange={setVisOp} options={VIS_OPS.map((v) => ({ value: v, label: v }))} />
          </Field>
          <Field label={t('field.visibility_value')}>
            <TextInput value={visValue} onChange={setVisValue} placeholder="true" />
          </Field>
        </div>
      </fieldset>

      {state.status === 'error' ? <SubmitError error={state.error} /> : null}

      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton type="submit" disabled={state.status === 'pending' || !key || !labelEn}>
          {state.status === 'pending' ? t('action.saving') : t('action.save')}
        </PrimaryButton>
        <GhostButton onClick={() => router.push(`/catalog/verticals/${verticalId}`)}>{t('action.cancel')}</GhostButton>
      </div>
    </form>
  );
}
