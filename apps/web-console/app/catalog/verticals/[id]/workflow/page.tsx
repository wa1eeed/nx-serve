'use client';
import { use, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiSend, useApi } from '../../../../../lib/api';
import { useLocale, useT, type Locale } from '../../../../../lib/i18n';
import type { StageDetail, TranslatableText, WorkflowDetail } from '../../../../../lib/types';
import { ErrorState, Loading, PageHeader } from '../../../../../components/page-parts';
import { Field, GhostButton, PrimaryButton, SubmitError, TextInput, useSubmit } from '../../../../../components/forms';

function localText(text: TranslatableText, locale: Locale): string {
  return text[locale] ?? text.en ?? '';
}

export default function WorkflowPage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const state = useApi<WorkflowDetail>(`/admin/verticals/${id}/workflow`, locale);
  const action = useSubmit();

  const [renaming, setRenaming] = useState(false);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');

  const noWorkflow = state.status === 'error' && state.error instanceof ApiError && state.error.status === 404;

  const createWorkflow = (): void => {
    void action.run(async () => {
      const name: Record<string, string> = { en: nameEn };
      if (nameAr.trim()) name.ar = nameAr.trim();
      await apiSend('POST', `/admin/verticals/${id}/workflow`, { name }, locale);
      state.reload();
    });
  };

  const rename = (workflowId: string): void => {
    void action.run(async () => {
      const name: Record<string, string> = { en: nameEn };
      if (nameAr.trim()) name.ar = nameAr.trim();
      await apiSend('PATCH', `/admin/workflows/${workflowId}`, { name }, locale);
      setRenaming(false);
      state.reload();
    });
  };

  const move = (workflow: WorkflowDetail, index: number, dir: -1 | 1): void => {
    const target = index + dir;
    if (target < 0 || target >= workflow.stages.length) return;
    const order = workflow.stages.map((s) => s.id);
    const moved = order[index]!;
    order[index] = order[target]!;
    order[target] = moved;
    void action.run(async () => {
      await apiSend('POST', `/admin/workflows/${workflow.id}/stages/reorder`, { order }, locale);
      state.reload();
    });
  };

  const removeStage = (stageId: string): void => {
    if (!window.confirm(t('delete.confirm_stage'))) return;
    void action.run(async () => {
      await apiSend('DELETE', `/admin/stages/${stageId}`, undefined, locale);
      state.reload();
    });
  };

  return (
    <>
      <PageHeader title={t('workflow.title')} intro={t('workflow.intro')} />

      {state.status === 'loading' ? <Loading /> : null}

      {noWorkflow ? (
        <div style={{ maxWidth: 480 }}>
          <p style={{ color: 'var(--nx-color-muted-foreground)' }}>{t('workflow.none')}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createWorkflow();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Field label={t('workflow.name_en')} required>
              <TextInput value={nameEn} onChange={setNameEn} />
            </Field>
            <Field label={t('workflow.name_ar')}>
              <TextInput value={nameAr} onChange={setNameAr} />
            </Field>
            {action.state.status === 'error' ? <SubmitError error={action.state.error} /> : null}
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton type="submit" disabled={action.state.status === 'pending' || !nameEn}>
                {action.state.status === 'pending' ? t('action.saving') : t('workflow.create')}
              </PrimaryButton>
              <GhostButton onClick={() => router.push(`/catalog/verticals/${id}`)}>{t('action.cancel')}</GhostButton>
            </div>
          </form>
        </div>
      ) : null}

      {state.status === 'error' && !noWorkflow ? <ErrorState error={state.error} onRetry={state.reload} /> : null}

      {state.status === 'ready' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {renaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  rename(state.data.id);
                }}
                style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <TextInput value={nameEn} onChange={setNameEn} placeholder={state.data.name.en} />
                <TextInput value={nameAr} onChange={setNameAr} placeholder={state.data.name.ar ?? ''} />
                <PrimaryButton type="submit" disabled={action.state.status === 'pending' || !nameEn}>
                  {t('action.save')}
                </PrimaryButton>
                <GhostButton onClick={() => setRenaming(false)}>{t('action.cancel')}</GhostButton>
              </form>
            ) : (
              <>
                <h2 style={{ fontSize: 18, margin: 0 }}>{localText(state.data.name, locale)}</h2>
                <GhostButton
                  onClick={() => {
                    setNameEn(state.data.name.en);
                    setNameAr(state.data.name.ar ?? '');
                    setRenaming(true);
                  }}
                >
                  {t('workflow.rename')}
                </GhostButton>
                <PrimaryButton onClick={() => router.push(`/catalog/verticals/${id}/workflow/stages/new`)}>
                  {t('workflow.add_stage')}
                </PrimaryButton>
              </>
            )}
          </div>

          {action.state.status === 'error' ? (
            <div style={{ marginBottom: 16 }}>
              <SubmitError error={action.state.error} />
            </div>
          ) : null}

          {state.data.stages.length === 0 ? (
            <p style={{ color: 'var(--nx-color-muted-foreground)' }}>{t('workflow.no_stages')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'start', color: 'var(--nx-color-muted-foreground)' }}>
                  <th style={cellHead}>#</th>
                  <th style={cellHead}>{t('common.name')}</th>
                  <th style={cellHead}>{t('stage.maps_to')}</th>
                  <th style={cellHead}>{t('stage.payment_action')}</th>
                  <th style={cellHead}>{t('stage.tracking_active')}</th>
                  <th style={cellHead}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {state.data.stages.map((s: StageDetail, i: number) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--nx-color-border)' }}>
                    <td style={cell}>{s.sort_order}</td>
                    <td style={cell}>
                      {localText(s.label, locale)} <code style={{ opacity: 0.6 }}>{s.code}</code>
                    </td>
                    <td style={cell}>{s.maps_to}</td>
                    <td style={cell}>{s.payment_action === 'none' ? '' : s.payment_action}</td>
                    <td style={cell}>{s.tracking_active ? '✓' : ''}</td>
                    <td style={cell}>
                      <span style={{ display: 'inline-flex', gap: 12 }}>
                        <button type="button" style={linkButton} title={t('workflow.move_up')} onClick={() => move(state.data, i, -1)} disabled={i === 0}>
                          ↑
                        </button>
                        <button
                          type="button"
                          style={linkButton}
                          title={t('workflow.move_down')}
                          onClick={() => move(state.data, i, 1)}
                          disabled={i === state.data.stages.length - 1}
                        >
                          ↓
                        </button>
                        <button type="button" style={linkButton} onClick={() => router.push(`/catalog/verticals/${id}/workflow/stages/${s.id}/edit`)}>
                          {t('action.edit')}
                        </button>
                        <button type="button" style={{ ...linkButton, color: 'var(--nx-color-destructive)' }} onClick={() => removeStage(s.id)}>
                          {t('action.delete')}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </>
  );
}

const cellHead = { padding: '8px 10px', fontWeight: 600 } as const;
const cell = { padding: '10px' } as const;
const linkButton = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--nx-color-primary)',
  font: 'inherit',
} as const;
