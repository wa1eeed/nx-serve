'use client';
import { use, type ReactNode } from 'react';
import { useApi } from '../../../../../../../lib/api';
import { useLocale, useT } from '../../../../../../../lib/i18n';
import type { WorkflowDetail } from '../../../../../../../lib/types';
import { ErrorState, Loading, PageHeader } from '../../../../../../../components/page-parts';
import { StageForm } from '../../../../../../../components/stage-form';

export default function NewStagePage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const t = useT();
  const locale = useLocale();
  const state = useApi<WorkflowDetail>(`/admin/verticals/${id}/workflow`, locale);

  return (
    <>
      <PageHeader title={t('stage.new_title')} />
      {state.status === 'loading' ? <Loading /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {state.status === 'ready' ? (
        <StageForm verticalId={id} workflowId={state.data.id} nextSortOrder={state.data.stages.length + 1} />
      ) : null}
    </>
  );
}
