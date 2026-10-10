'use client';
import { use, type ReactNode } from 'react';
import { useApi } from '../../../../../../../lib/api';
import { useLocale, useT } from '../../../../../../../lib/i18n';
import type { CategoryDetail } from '../../../../../../../lib/types';
import { ErrorState, Loading, PageHeader } from '../../../../../../../components/page-parts';
import { CategoryForm } from '../../../../../../../components/category-form';

export default function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string; categoryId: string }>;
}): ReactNode {
  const { id, categoryId } = use(params);
  const t = useT();
  const locale = useLocale();
  const state = useApi<CategoryDetail>(`/admin/categories/${categoryId}`, locale);

  return (
    <>
      <PageHeader title={t('category.edit_title')} />
      {state.status === 'loading' ? <Loading /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {state.status === 'ready' ? <CategoryForm verticalId={id} initial={state.data} /> : null}
    </>
  );
}
