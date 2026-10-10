'use client';
import { useState, type ReactNode } from 'react';
import { apiSend, useApi } from '../../../lib/api';
import { useLocale, useT, type Locale } from '../../../lib/i18n';
import { ErrorState, Loading, PageHeader } from '../../../components/page-parts';
import { CheckboxInput, Field, GhostButton, PrimaryButton, SubmitError, TextInput, useSubmit } from '../../../components/forms';

interface SurgeSchedule {
  id: string;
  name: Record<string, string>;
  tier_id: string | null;
  days_of_week: number[] | null;
  time_from: string | null;
  time_to: string | null;
  multiplier: number;
  is_active: boolean;
}

const localName = (name: Record<string, string>, locale: Locale): string => name[locale] ?? name.en ?? '';

/** Parses "5, 6" into [5, 6], keeping only whole 0..6 day indices. Empty tokens are
 * dropped first so a blank field yields [] (no day restriction), not [0] (Sunday only). */
function parseDays(input: string): number[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

/** Zero-pads a single-digit hour so "8:00" becomes "08:00" and passes the API's HH:MM. */
function padTime(t: string): string {
  const trimmed = t.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!m) return trimmed;
  return `${(m[1] ?? '').padStart(2, '0')}:${m[2] ?? ''}`;
}

export default function SurgePage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const state = useApi<SurgeSchedule[]>('/admin/pricing/surge-schedules', locale);
  const create = useSubmit();
  const del = useSubmit();

  const [f, setF] = useState({ name_en: '', name_ar: '', tier_id: '', days: '', time_from: '', time_to: '', multiplier: '1.2', is_active: true });
  const set = (k: keyof typeof f, v: string | boolean): void => setF((p) => ({ ...p, [k]: v }));

  const add = (): void => {
    const days = parseDays(f.days);
    void create.run(async () => {
      await apiSend('POST', '/admin/pricing/surge-schedules', {
        name: { en: f.name_en, ...(f.name_ar ? { ar: f.name_ar } : {}) },
        ...(f.tier_id.trim() ? { tier_id: f.tier_id.trim() } : {}),
        ...(days.length ? { days_of_week: days } : {}),
        ...(f.time_from.trim() ? { time_from: padTime(f.time_from) } : {}),
        ...(f.time_to.trim() ? { time_to: padTime(f.time_to) } : {}),
        multiplier: Number(f.multiplier),
        is_active: f.is_active,
      }, locale);
      setF({ name_en: '', name_ar: '', tier_id: '', days: '', time_from: '', time_to: '', multiplier: '1.2', is_active: true });
      state.reload();
    });
  };

  const remove = (id: string): void => {
    void del.run(async () => {
      await apiSend('DELETE', `/admin/pricing/surge-schedules/${id}`, undefined, locale);
      state.reload();
    });
  };

  return (
    <>
      <PageHeader title={t('su.title')} intro={t('su.intro')} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, marginBottom: 28, padding: 18, border: '1px solid var(--nx-color-border)', borderRadius: 'var(--nx-radius-lg)', background: 'var(--nx-color-card)' }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>{t('su.new')}</h2>
        <Row>
          <Field label={`${t('su.name')} (EN)`} required>
            <TextInput required value={f.name_en} onChange={(v) => set('name_en', v)} />
          </Field>
          <Field label={`${t('su.name')} (ع)`}>
            <TextInput value={f.name_ar} onChange={(v) => set('name_ar', v)} />
          </Field>
        </Row>
        <Field label={t('su.tier_id')}>
          <TextInput value={f.tier_id} onChange={(v) => set('tier_id', v)} />
        </Field>
        <Field label={t('su.days')}>
          <TextInput value={f.days} onChange={(v) => set('days', v)} placeholder="5, 6" />
        </Field>
        <Row>
          <Field label={t('su.time_from')}>
            <TextInput value={f.time_from} onChange={(v) => set('time_from', v)} placeholder="18:00" />
          </Field>
          <Field label={t('su.time_to')}>
            <TextInput value={f.time_to} onChange={(v) => set('time_to', v)} placeholder="23:00" />
          </Field>
        </Row>
        <Row>
          <Field label={t('su.multiplier')} required>
            <TextInput required type="number" min={1} value={f.multiplier} onChange={(v) => set('multiplier', v)} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <CheckboxInput label={t('su.active')} value={f.is_active} onChange={(v) => set('is_active', v)} />
          </div>
        </Row>
        {create.state.status === 'error' ? <SubmitError error={create.state.error} /> : null}
        <div>
          <PrimaryButton type="submit" disabled={create.state.status === 'pending'}>
            {create.state.status === 'pending' ? t('action.saving') : t('action.save')}
          </PrimaryButton>
        </div>
      </form>

      {del.state.status === 'error' ? (
        <div style={{ marginBottom: 16 }}>
          <SubmitError error={del.state.error} />
        </div>
      ) : null}

      {state.status === 'loading' ? <Loading /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 ? (
          <p style={{ color: 'var(--nx-color-muted-foreground)' }}>{t('common.empty')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'start', color: 'var(--nx-color-muted-foreground)' }}>
                <th style={cellHead}>{t('common.name')}</th>
                <th style={cellHead}>{t('su.days')}</th>
                <th style={cellHead}>{t('su.multiplier')}</th>
                <th style={cellHead}>{t('su.active')}</th>
                <th style={cellHead}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--nx-color-border)' }}>
                  <td style={cell}>{localName(s.name, locale)}</td>
                  <td style={cell}>{s.days_of_week?.join(', ') ?? '—'}</td>
                  <td style={cell}>{s.multiplier}×</td>
                  <td style={cell}>{s.is_active ? '●' : '○'}</td>
                  <td style={cell}>
                    <GhostButton onClick={() => remove(s.id)}>{t('action.delete')}</GhostButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </>
  );
}

function Row({ children }: { children: ReactNode }): ReactNode {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>;
}
const cellHead = { padding: '8px 10px', fontWeight: 600 } as const;
const cell = { padding: '10px' } as const;
