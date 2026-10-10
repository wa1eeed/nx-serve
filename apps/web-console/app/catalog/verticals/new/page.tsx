'use client';
import type { ReactNode } from 'react';
import { useT } from '../../../../lib/i18n';
import { PageHeader } from '../../../../components/page-parts';
import { VerticalForm } from '../../../../components/vertical-form';

export default function NewVerticalPage(): ReactNode {
  const t = useT();
  return (
    <>
      <PageHeader title={t('vertical.new_title')} intro={t('vertical.new_intro')} />
      <VerticalForm />
    </>
  );
}
