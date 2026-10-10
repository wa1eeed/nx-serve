'use client';
import { use, type ReactNode } from 'react';
import { useT } from '../../../../../../lib/i18n';
import { PageHeader } from '../../../../../../components/page-parts';
import { CategoryForm } from '../../../../../../components/category-form';

export default function NewCategoryPage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const t = useT();
  return (
    <>
      <PageHeader title={t('category.new_title')} />
      <CategoryForm verticalId={id} />
    </>
  );
}
