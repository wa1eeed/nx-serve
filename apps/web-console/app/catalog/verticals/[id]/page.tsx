'use client';
import { use, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiSend, useApi } from '../../../../lib/api';
import { useLocale, useT, type Locale } from '../../../../lib/i18n';
import type { CategoryDetail, FieldDetail, TranslatableText, VerticalDetail } from '../../../../lib/types';
import { ErrorState, Loading, PageHeader } from '../../../../components/page-parts';
import { GhostButton, PrimaryButton, useSubmit } from '../../../../components/forms';

function localName(name: TranslatableText, locale: Locale): string {
  return name[locale] ?? name.en ?? '';
}

export default function VerticalDetailPage({ params }: { params: Promise<{ id: string }> }): ReactNode {
  const { id } = use(params);
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const vertical = useApi<VerticalDetail>(`/admin/verticals/${id}`, locale);
  const categories = useApi<CategoryDetail[]>(`/admin/verticals/${id}/categories`, locale);
  const fields = useApi<FieldDetail[]>(`/admin/verticals/${id}/fields`, locale);
  const del = useSubmit();

  const remove = (method: 'vertical' | 'category' | 'field', targetId: string): void => {
    const confirmKey =
      method === 'vertical' ? 'delete.confirm_vertical' : method === 'category' ? 'delete.confirm_category' : 'delete.confirm_field';
    if (!window.confirm(t(confirmKey))) return;
    void del.run(async () => {
      if (method === 'vertical') {
        await apiSend('DELETE', `/admin/verticals/${targetId}`, undefined, locale);
        router.push('/catalog/verticals');
      } else if (method === 'category') {
        await apiSend('DELETE', `/admin/categories/${targetId}`, undefined, locale);
        categories.reload();
      } else {
        await apiSend('DELETE', `/admin/fields/${targetId}`, undefined, locale);
        fields.reload();
      }
    });
  };

  const title = vertical.status === 'ready' ? localName(vertical.data.name, locale) : t('detail.vertical');

  return (
    <>
      <PageHeader title={title} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <PrimaryButton onClick={() => router.push(`/catalog/verticals/${id}/edit`)}>{t('action.edit')}</PrimaryButton>
        <GhostButton onClick={() => router.push(`/catalog/verticals/${id}/workflow`)}>{t('nav.workflow')}</GhostButton>
        <GhostButton onClick={() => router.push(`/catalog/verticals/${id}/form`)}>{t('verticals.preview')}</GhostButton>
        <GhostButton onClick={() => remove('vertical', id)}>{t('action.delete')}</GhostButton>
      </div>

      {/* Order fields */}
      <Section
        title={t('detail.fields')}
        action={<GhostButton onClick={() => router.push(`/catalog/verticals/${id}/fields/new`)}>{t('action.add_field')}</GhostButton>}
      >
        {fields.status === 'loading' ? <Loading /> : null}
        {fields.status === 'error' ? <ErrorState error={fields.error} onRetry={fields.reload} /> : null}
        {fields.status === 'ready' ? (
          fields.data.length === 0 ? (
            <Empty text={t('detail.no_fields')} />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={headRow}>
                  <th style={cellHead}>{t('field.key')}</th>
                  <th style={cellHead}>{t('detail.type')}</th>
                  <th style={cellHead}>{t('field.required')}</th>
                  <th style={cellHead}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {fields.data.map((f) => (
                  <tr key={f.id} style={bodyRow}>
                    <td style={cell}>
                      <code>{f.key}</code>
                    </td>
                    <td style={cell}>{f.data_type}</td>
                    <td style={cell}>{f.required ? '✓' : ''}</td>
                    <td style={cell}>
                      <RowActions
                        onEdit={() => router.push(`/catalog/verticals/${id}/fields/${f.id}/edit`)}
                        onDelete={() => remove('field', f.id)}
                        t={t}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </Section>

      {/* Categories */}
      <Section
        title={t('detail.categories')}
        action={<GhostButton onClick={() => router.push(`/catalog/verticals/${id}/categories/new`)}>{t('action.add_category')}</GhostButton>}
      >
        {categories.status === 'loading' ? <Loading /> : null}
        {categories.status === 'error' ? <ErrorState error={categories.error} onRetry={categories.reload} /> : null}
        {categories.status === 'ready' ? (
          categories.data.length === 0 ? (
            <Empty text={t('detail.no_categories')} />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={headRow}>
                  <th style={cellHead}>{t('common.name')}</th>
                  <th style={cellHead}>{t('common.code')}</th>
                  <th style={cellHead}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {categories.data.map((c) => (
                  <tr key={c.id} style={bodyRow}>
                    <td style={cell}>{localName(c.name, locale)}</td>
                    <td style={cell}>
                      <code>{c.code}</code>
                    </td>
                    <td style={cell}>
                      <RowActions
                        onEdit={() => router.push(`/catalog/verticals/${id}/categories/${c.id}/edit`)}
                        onDelete={() => remove('category', c.id)}
                        t={t}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </Section>
    </>
  );
}

function Section({ title, action, children }: { title: string; action: ReactNode; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }): ReactNode {
  return <p style={{ color: 'var(--nx-color-muted-foreground)' }}>{text}</p>;
}

function RowActions({
  onEdit,
  onDelete,
  t,
}: {
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}): ReactNode {
  return (
    <span style={{ display: 'inline-flex', gap: 14 }}>
      <button type="button" onClick={onEdit} style={linkButton}>
        {t('action.edit')}
      </button>
      <button type="button" onClick={onDelete} style={{ ...linkButton, color: 'var(--nx-color-destructive)' }}>
        {t('action.delete')}
      </button>
    </span>
  );
}

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 14 } as const;
const headRow = { textAlign: 'start', color: 'var(--nx-color-muted-foreground)' } as const;
const bodyRow = { borderTop: '1px solid var(--nx-color-border)' } as const;
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
