'use client';
import { use, type ReactNode } from 'react';
import { useT } from '../../../../../../lib/i18n';
import { PageHeader } from '../../../../../../components/page-parts';
import { FieldForm } from '../../../../../../components/field-form';

export default function NewFieldPage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const t = useT();
  return (
    <>
      <PageHeader title={t('fieldeditor.title')} intro={t('fieldeditor.intro')} />
      <FieldForm verticalId={id} />
    </>
  );
}
