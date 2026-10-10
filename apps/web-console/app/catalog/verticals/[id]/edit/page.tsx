'use client';
import { use, type ReactNode } from 'react';
import { useApi } from '../../../../../lib/api';
import { useLocale, useT } from '../../../../../lib/i18n';
import type { VerticalDetail } from '../../../../../lib/types';
import { ErrorState, Loading, PageHeader } from '../../../../../components/page-parts';
import { VerticalForm } from '../../../../../components/vertical-form';

export default function EditVerticalPage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const t = useT();
  const locale = useLocale();
  const state = useApi<VerticalDetail>(`/admin/verticals/${id}`, locale);

  return (
    <>
      <PageHeader title={t('vertical.edit_title')} />
      {state.status === 'loading' ? <Loading /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {state.status === 'ready' ? <VerticalForm initial={state.data} /> : null}
    </>
  );
}
