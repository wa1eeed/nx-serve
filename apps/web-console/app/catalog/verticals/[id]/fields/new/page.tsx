'use client';
import { use, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiSend } from '../../../../../../lib/api';
import { useLocale, useT } from '../../../../../../lib/i18n';
import { PageHeader } from '../../../../../../components/page-parts';
import {
  CheckboxInput,
  Field,
  GhostButton,
  PrimaryButton,
  SelectInput,
  SubmitError,
  TextInput,
  useSubmit,
} from '../../../../../../components/forms';

const FIELD_TYPES = [
  'text', 'number', 'boolean', 'single_select', 'multi_select',
  'date', 'location', 'media', 'item_list', 'reference',
];
const SCOPES = ['order', 'provider_capability', 'asset'];
const VIS_OPS = ['eq', 'ne', 'in'];

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

export default function NewFieldPage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { state, run } = useSubmit();

  const [key, setKey] = useState('');
  const [dataType, setDataType] = useState('text');
  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [required, setRequired] = useState(false);
  const [scope, setScope] = useState('order');
  const [sortOrder, setSortOrder] = useState('0');
  const [referenceSource, setReferenceSource] = useState('');
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [visKey, setVisKey] = useState('');
  const [visOp, setVisOp] = useState('eq');
  const [visValue, setVisValue] = useState('');

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
        scope,
        sort_order: Number(sortOrder) || 0,
      };
      if (hasOptions && options.length > 0) {
        body.options = options.map((o) => {
          const optLabel: Record<string, string> = { en: o.labelEn };
          if (o.labelAr.trim()) optLabel.ar = o.labelAr.trim();
          return { value: o.value, label: optLabel };
        });
      }
      if (isReference && referenceSource.trim()) body.reference_source = referenceSource.trim();
      if (visKey.trim()) {
        body.visibility_rule =
          visOp === 'in'
            ? { key: visKey.trim(), in: visValue.split(',').map((s) => coerce(s.trim())) }
            : { key: visKey.trim(), [visOp]: coerce(visValue) };
      }

      await apiSend('POST', `/admin/verticals/${id}/fields`, body, locale);
      router.push(`/catalog/verticals/${id}/form`);
    });
  };

  return (
    <>
      <PageHeader title={t('fieldeditor.title')} intro={t('fieldeditor.intro')} />
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
        <Field label={t('field.scope')}>
          <SelectInput value={scope} onChange={setScope} options={SCOPES.map((v) => ({ value: v, label: v }))} />
        </Field>
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
          <GhostButton onClick={() => router.push(`/catalog/verticals/${id}/form`)}>{t('action.cancel')}</GhostButton>
        </div>
      </form>
    </>
  );
}
