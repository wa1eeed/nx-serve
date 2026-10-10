'use client';
import { use, type ReactNode } from 'react';
import { useApi } from '../../../../../../../../lib/api';
import { useLocale, useT } from '../../../../../../../../lib/i18n';
import type { WorkflowDetail } from '../../../../../../../../lib/types';
import { ErrorState, Loading, PageHeader } from '../../../../../../../../components/page-parts';
import { StageForm } from '../../../../../../../../components/stage-form';

export default function EditStagePage({
  params,
}: {
  params: Promise<{ id: string; stageId: string }>;
}): ReactNode {
  const { id, stageId } = use(params);
  const t = useT();
  const locale = useLocale();
  const state = useApi<WorkflowDetail>(`/admin/verticals/${id}/workflow`, locale);
  const stage = state.status === 'ready' ? state.data.stages.find((s) => s.id === stageId) : undefined;

  return (
    <>
      <PageHeader title={t('stage.edit_title')} />
      {state.status === 'loading' ? <Loading /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {state.status === 'ready' && stage ? (
        <StageForm verticalId={id} workflowId={state.data.id} initial={stage} />
      ) : null}
      {state.status === 'ready' && !stage ? (
        <p style={{ color: 'var(--nx-color-muted-foreground)' }}>{t('common.empty')}</p>
      ) : null}
    </>
  );
}
