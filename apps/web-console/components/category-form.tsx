'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiSend } from '../lib/api';
import { useLocale, useT } from '../lib/i18n';
import type { CategoryDetail } from '../lib/types';
import { Field, GhostButton, PrimaryButton, SelectInput, SubmitError, TextInput, useSubmit } from './forms';

const FULFILLMENT = ['', 'at_customer', 'point_to_point', 'at_provider', 'remote'];
const TRACKING = ['', 'none', 'en_route', 'full_trip'];

export function CategoryForm({ verticalId, initial }: { verticalId: string; initial?: CategoryDetail }): ReactNode {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { state, run } = useSubmit();
  const editing = Boolean(initial);

  const [code, setCode] = useState(initial?.code ?? '');
  const [nameEn, setNameEn] = useState(initial?.name.en ?? '');
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? '');
  const [fulfillment, setFulfillment] = useState(initial?.fulfillment ?? '');
  const [tracking, setTracking] = useState(initial?.tracking ?? '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));

  const back = (): void => router.push(`/catalog/verticals/${verticalId}`);

  const submit = (): void => {
    void run(async () => {
      const name: Record<string, string> = { en: nameEn };
      if (nameAr.trim()) name.ar = nameAr.trim();
      const body: Record<string, unknown> = {
        name,
        sort_order: Number(sortOrder) || 0,
        fulfillment: fulfillment || undefined,
        tracking: tracking || undefined,
      };
      if (editing && initial) {
        await apiSend('PATCH', `/admin/categories/${initial.id}`, body, locale);
      } else {
        await apiSend('POST', `/admin/verticals/${verticalId}/categories`, { ...body, code }, locale);
      }
      back();
    });
  };

  const inherit = locale === 'ar' ? '(موروث)' : '(inherit)';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}
    >
      {!editing ? (
        <Field label={t('field.code')} required>
          <TextInput value={code} onChange={setCode} placeholder="light_vehicles" />
        </Field>
      ) : null}
      <Field label={t('field.name_en')} required>
        <TextInput value={nameEn} onChange={setNameEn} />
      </Field>
      <Field label={t('field.name_ar')}>
        <TextInput value={nameAr} onChange={setNameAr} />
      </Field>
      <Field label={t('field.fulfillment')}>
        <SelectInput
          value={fulfillment}
          onChange={setFulfillment}
          options={FULFILLMENT.map((v) => ({ value: v, label: v === '' ? inherit : v }))}
        />
      </Field>
      <Field label={t('field.tracking')}>
        <SelectInput value={tracking} onChange={setTracking} options={TRACKING.map((v) => ({ value: v, label: v === '' ? inherit : v }))} />
      </Field>
      <Field label={t('field.sort_order')}>
        <TextInput type="number" value={sortOrder} onChange={setSortOrder} />
      </Field>

      {state.status === 'error' ? <SubmitError error={state.error} /> : null}

      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton type="submit" disabled={state.status === 'pending' || (!editing && !code) || !nameEn}>
          {state.status === 'pending' ? t('action.saving') : t('action.save')}
        </PrimaryButton>
        <GhostButton onClick={back}>{t('action.cancel')}</GhostButton>
      </div>
    </form>
  );
}
