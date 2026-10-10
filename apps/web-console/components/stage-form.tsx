'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiSend } from '../lib/api';
import { useT, useLocale } from '../lib/i18n';
import type { StageDetail } from '../lib/types';
import {
  CheckboxInput,
  Field,
  GhostButton,
  PrimaryButton,
  SelectInput,
  SubmitError,
  TextArea,
  TextInput,
  useSubmit,
} from './forms';

const ORDER_STATUS = [
  'draft', 'quoting', 'awaiting_payment', 'dispatching', 'assigned', 'authorized',
  'en_route', 'arrived', 'in_progress', 'completed', 'captured', 'cancelled', 'failed', 'disputed',
];
const ACTORS = ['agent', 'customer', 'system', 'ops'];
const PAYMENT_ACTIONS = ['none', 'authorize', 'capture', 'capture_partial', 'capture_pct', 'deposit', 'supplement'];

export function StageForm({
  verticalId,
  workflowId,
  initial,
  nextSortOrder,
}: {
  verticalId: string;
  workflowId: string;
  initial?: StageDetail;
  nextSortOrder?: number;
}): ReactNode {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { state, run } = useSubmit();
  const editing = Boolean(initial);

  const [code, setCode] = useState(initial?.code ?? '');
  const [labelEn, setLabelEn] = useState(initial?.label.en ?? '');
  const [labelAr, setLabelAr] = useState(initial?.label.ar ?? '');
  const [mapsTo, setMapsTo] = useState(initial?.maps_to ?? 'assigned');
  const [actor, setActor] = useState(initial?.actor ?? 'agent');
  const [trackingActive, setTrackingActive] = useState(initial?.tracking_active ?? false);
  const [paymentAction, setPaymentAction] = useState(initial?.payment_action ?? 'none');
  const [sla, setSla] = useState(initial?.sla_minutes != null ? String(initial.sla_minutes) : '');
  const [requires, setRequires] = useState(
    initial && Object.keys(initial.requires).length > 0 ? JSON.stringify(initial.requires, null, 2) : '',
  );
  const [jsonError, setJsonError] = useState(false);

  const back = (): void => router.push(`/catalog/verticals/${verticalId}/workflow`);

  const submit = (): void => {
    let parsedRequires: Record<string, unknown> = {};
    if (requires.trim()) {
      try {
        parsedRequires = JSON.parse(requires) as Record<string, unknown>;
        setJsonError(false);
      } catch {
        setJsonError(true);
        return;
      }
    }
    void run(async () => {
      const label: Record<string, string> = { en: labelEn };
      if (labelAr.trim()) label.ar = labelAr.trim();
      const body: Record<string, unknown> = {
        label,
        maps_to: mapsTo,
        actor,
        tracking_active: trackingActive,
        payment_action: paymentAction,
        requires: parsedRequires,
        sla_minutes: sla.trim() ? Number(sla) : null,
        sort_order: initial?.sort_order ?? nextSortOrder ?? 0,
      };
      if (editing && initial) {
        await apiSend('PATCH', `/admin/stages/${initial.id}`, body, locale);
      } else {
        await apiSend('POST', `/admin/workflows/${workflowId}/stages`, { ...body, code }, locale);
      }
      back();
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
      {!editing ? (
        <Field label={t('field.code')} required>
          <TextInput value={code} onChange={setCode} placeholder="heading_to_pickup" />
        </Field>
      ) : null}
      <Field label={t('field.label_en')} required>
        <TextInput value={labelEn} onChange={setLabelEn} />
      </Field>
      <Field label={t('field.label_ar')}>
        <TextInput value={labelAr} onChange={setLabelAr} />
      </Field>
      <Field label={t('stage.maps_to')} required>
        <SelectInput value={mapsTo} onChange={setMapsTo} options={ORDER_STATUS.map((v) => ({ value: v, label: v }))} />
      </Field>
      <Field label={t('stage.actor')}>
        <SelectInput value={actor} onChange={setActor} options={ACTORS.map((v) => ({ value: v, label: v }))} />
      </Field>
      <CheckboxInput label={t('stage.tracking_active')} value={trackingActive} onChange={setTrackingActive} />
      <Field label={t('stage.payment_action')}>
        <SelectInput value={paymentAction} onChange={setPaymentAction} options={PAYMENT_ACTIONS.map((v) => ({ value: v, label: v }))} />
      </Field>
      <Field label={t('stage.sla_minutes')}>
        <TextInput type="number" value={sla} onChange={setSla} />
      </Field>
      <Field label={t('stage.requires')}>
        <TextArea value={requires} onChange={setRequires} placeholder='{ "photos_min": 2, "otp": true }' />
      </Field>
      {jsonError ? <span style={{ color: 'var(--nx-color-destructive)', fontSize: 13 }}>{t('stage.requires_invalid')}</span> : null}

      {state.status === 'error' ? <SubmitError error={state.error} /> : null}

      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton type="submit" disabled={state.status === 'pending' || (!editing && !code) || !labelEn}>
          {state.status === 'pending' ? t('action.saving') : t('action.save')}
        </PrimaryButton>
        <GhostButton onClick={back}>{t('action.cancel')}</GhostButton>
      </div>
    </form>
  );
}
