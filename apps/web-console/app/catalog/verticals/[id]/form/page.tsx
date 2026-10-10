'use client';
import { use, type ReactNode } from 'react';
import type { FormSchema } from '@nxserve/domain';
import { DynamicForm } from '@nxserve/ui-web';
import { useApi } from '../../../../../lib/api';
import { useLocale, useT } from '../../../../../lib/i18n';
import { Loading, PageHeader } from '../../../../../components/page-parts';
import { sampleForm } from '../../../../../lib/sample-form';

export default function FormPreviewPage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const t = useT();
  const locale = useLocale();
  const state = useApi<FormSchema>(`/catalog/verticals/${id}/form`, locale);

  if (state.status === 'loading') {
    return (
      <>
        <PageHeader title={t('form.title')} intro={t('form.intro')} />
        <Loading />
      </>
    );
  }

  // On any API failure fall back to the bundled sample so the renderer is always
  // demonstrable; the banner says so honestly rather than faking tenant data.
  const schema = state.status === 'ready' ? state.data : sampleForm(locale);
  const isSample = state.status !== 'ready';

  return (
    <>
      <PageHeader title={t('form.title')} intro={t('form.intro')} />
      {isSample ? (
        <p
          style={{
            color: 'var(--nx-color-muted-foreground)',
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {t('form.sample')}
        </p>
      ) : null}
      <div
        style={{
          maxWidth: 480,
          padding: 24,
          borderRadius: 'var(--nx-radius-lg)',
          border: '1px solid var(--nx-color-border)',
          background: 'var(--nx-color-card)',
        }}
      >
        <DynamicForm
          schema={schema}
          submitLabel={t('form.submit')}
          onSubmit={(values) => {
            // Preview only: no order is created here.
            // eslint-disable-next-line no-console
            console.log('preview values', values);
          }}
        />
      </div>
    </>
  );
}
