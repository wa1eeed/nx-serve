'use client';
import { use, type ReactNode } from 'react';
import { useApi } from '../../../../../../../lib/api';
import { useLocale, useT } from '../../../../../../../lib/i18n';
import type { FieldDetail } from '../../../../../../../lib/types';
import { ErrorState, Loading, PageHeader } from '../../../../../../../components/page-parts';
import { FieldForm } from '../../../../../../../components/field-form';

export default function EditFieldPage({
  params,
}: {
  params: Promise<{ id: string; fieldId: string }>;
}): ReactNode {
  const { id, fieldId } = use(params);
  const t = useT();
  const locale = useLocale();
  const state = useApi<FieldDetail>(`/admin/fields/${fieldId}`, locale);

  return (
    <>
      <PageHeader title={t('fieldeditor.edit_title')} intro={t('fieldeditor.intro')} />
      {state.status === 'loading' ? <Loading /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {state.status === 'ready' ? <FieldForm verticalId={id} initial={state.data} /> : null}
    </>
  );
}
