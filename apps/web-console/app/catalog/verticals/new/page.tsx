'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiSend } from '../../../../lib/api';
import { useLocale, useT } from '../../../../lib/i18n';
import { PageHeader } from '../../../../components/page-parts';
import { Field, GhostButton, PrimaryButton, SelectInput, SubmitError, TextInput, useSubmit } from '../../../../components/forms';

const FULFILLMENT = ['at_customer', 'point_to_point', 'at_provider', 'remote'];
const TRACKING = ['none', 'en_route', 'full_trip'];

export default function NewVerticalPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { state, run } = useSubmit();

  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [fulfillment, setFulfillment] = useState('at_customer');
  const [tracking, setTracking] = useState('none');

  const submit = (): void => {
    void run(async () => {
      const name: Record<string, string> = { en: nameEn };
      if (nameAr.trim()) name.ar = nameAr.trim();
      const created = await apiSend<{ id: string }>(
        'POST',
        '/admin/verticals',
        { code, name, default_fulfillment: fulfillment, default_tracking: tracking },
        locale,
      );
      router.push(`/catalog/verticals/${created.id}/fields/new`);
    });
  };

  return (
    <>
      <PageHeader title={t('vertical.new_title')} intro={t('vertical.new_intro')} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}
      >
        <Field label={t('field.code')} required>
          <TextInput value={code} onChange={setCode} placeholder="towing" />
        </Field>
        <Field label={t('field.name_en')} required>
          <TextInput value={nameEn} onChange={setNameEn} />
        </Field>
        <Field label={t('field.name_ar')}>
          <TextInput value={nameAr} onChange={setNameAr} />
        </Field>
        <Field label={t('field.fulfillment')} required>
          <SelectInput
            value={fulfillment}
            onChange={setFulfillment}
            options={FULFILLMENT.map((v) => ({ value: v, label: v }))}
          />
        </Field>
        <Field label={t('field.tracking')} required>
          <SelectInput value={tracking} onChange={setTracking} options={TRACKING.map((v) => ({ value: v, label: v }))} />
        </Field>

        {state.status === 'error' ? <SubmitError error={state.error} /> : null}

        <div style={{ display: 'flex', gap: 10 }}>
          <PrimaryButton type="submit" disabled={state.status === 'pending' || !code || !nameEn}>
            {state.status === 'pending' ? t('action.saving') : t('action.save')}
          </PrimaryButton>
          <GhostButton onClick={() => router.push('/catalog/verticals')}>{t('action.cancel')}</GhostButton>
        </div>
      </form>
    </>
  );
}
