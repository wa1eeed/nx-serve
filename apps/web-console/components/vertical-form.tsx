'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiSend } from '../lib/api';
import { useLocale, useT } from '../lib/i18n';
import type { VerticalDetail } from '../lib/types';
import { Field, GhostButton, PrimaryButton, SelectInput, SubmitError, TextInput, useSubmit } from './forms';

const FULFILLMENT = ['at_customer', 'point_to_point', 'at_provider', 'remote'];
const TRACKING = ['none', 'en_route', 'full_trip'];

export function VerticalForm({ initial }: { initial?: VerticalDetail }): ReactNode {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { state, run } = useSubmit();
  const editing = Boolean(initial);

  const [code, setCode] = useState(initial?.code ?? '');
  const [nameEn, setNameEn] = useState(initial?.name.en ?? '');
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? '');
  const [fulfillment, setFulfillment] = useState(initial?.default_fulfillment ?? 'at_customer');
  const [tracking, setTracking] = useState(initial?.default_tracking ?? 'none');

  const submit = (): void => {
    void run(async () => {
      const name: Record<string, string> = { en: nameEn };
      if (nameAr.trim()) name.ar = nameAr.trim();
      const body: Record<string, unknown> = {
        name,
        default_fulfillment: fulfillment,
        default_tracking: tracking,
      };
      if (editing && initial) {
        await apiSend('PATCH', `/admin/verticals/${initial.id}`, body, locale);
        router.push(`/catalog/verticals/${initial.id}`);
      } else {
        const created = await apiSend<{ id: string }>('POST', '/admin/verticals', { ...body, code }, locale);
        router.push(`/catalog/verticals/${created.id}`);
      }
    });
  };

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
          <TextInput value={code} onChange={setCode} placeholder="towing" />
        </Field>
      ) : null}
      <Field label={t('field.name_en')} required>
        <TextInput value={nameEn} onChange={setNameEn} />
      </Field>
      <Field label={t('field.name_ar')}>
        <TextInput value={nameAr} onChange={setNameAr} />
      </Field>
      <Field label={t('field.fulfillment')} required>
        <SelectInput value={fulfillment} onChange={setFulfillment} options={FULFILLMENT.map((v) => ({ value: v, label: v }))} />
      </Field>
      <Field label={t('field.tracking')} required>
        <SelectInput value={tracking} onChange={setTracking} options={TRACKING.map((v) => ({ value: v, label: v }))} />
      </Field>

      {state.status === 'error' ? <SubmitError error={state.error} /> : null}

      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton type="submit" disabled={state.status === 'pending' || (!editing && !code) || !nameEn}>
          {state.status === 'pending' ? t('action.saving') : t('action.save')}
        </PrimaryButton>
        <GhostButton onClick={() => router.push('/catalog/verticals')}>{t('action.cancel')}</GhostButton>
      </div>
    </form>
  );
}
