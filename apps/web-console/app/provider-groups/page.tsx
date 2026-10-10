'use client';
import { useState, type ReactNode } from 'react';
import { apiSend, useApi } from '../../lib/api';
import { useLocale, useT, type Locale } from '../../lib/i18n';
import type { ProviderGroupDetail, TranslatableText } from '../../lib/types';
import { ErrorState, Loading, PageHeader } from '../../components/page-parts';
import { Field, GhostButton, PrimaryButton, SubmitError, TextInput, useSubmit } from '../../components/forms';

function localName(name: TranslatableText, locale: Locale): string {
  return name[locale] ?? name.en ?? '';
}

export default function ProviderGroupsPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const groups = useApi<ProviderGroupDetail[]>('/admin/provider-groups', locale);
  const create = useSubmit();
  const member = useSubmit();

  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');

  const submitCreate = (): void =>
    void create.run(async () => {
      const name: Record<string, string> = { en: nameEn };
      if (nameAr.trim()) name.ar = nameAr.trim();
      await apiSend('POST', '/admin/provider-groups', { name }, locale);
      setNameEn('');
      setNameAr('');
      groups.reload();
    });

  const addMember = (groupId: string): void => {
    const orgId = window.prompt(t('groups.member_org'))?.trim();
    const agentId = orgId ? undefined : window.prompt(t('groups.member_agent'))?.trim();
    if (!orgId && !agentId) return;
    void member.run(async () => {
      await apiSend(
        'POST',
        `/admin/provider-groups/${groupId}/members`,
        { ...(orgId ? { org_id: orgId } : {}), ...(agentId ? { agent_id: agentId } : {}) },
        locale,
      );
    });
  };

  return (
    <>
      <PageHeader title={t('groups.title')} intro={t('groups.intro')} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitCreate();
        }}
        style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 24, maxWidth: 640 }}
      >
        <Field label={t('field.name_en')} required>
          <TextInput value={nameEn} onChange={setNameEn} />
        </Field>
        <Field label={t('field.name_ar')}>
          <TextInput value={nameAr} onChange={setNameAr} />
        </Field>
        <PrimaryButton type="submit" disabled={create.state.status === 'pending' || !nameEn}>
          {t('groups.new')}
        </PrimaryButton>
      </form>
      {create.state.status === 'error' ? (
        <div style={{ marginBottom: 16 }}>
          <SubmitError error={create.state.error} />
        </div>
      ) : null}
      {member.state.status === 'error' ? (
        <div style={{ marginBottom: 16 }}>
          <SubmitError error={member.state.error} />
        </div>
      ) : null}

      {groups.status === 'loading' ? <Loading /> : null}
      {groups.status === 'error' ? <ErrorState error={groups.error} onRetry={groups.reload} /> : null}
      {groups.status === 'ready' ? (
        groups.data.length === 0 ? (
          <p style={{ color: 'var(--nx-color-muted-foreground)' }}>{t('common.empty')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {groups.data.map((g) => (
                <tr key={g.id} style={{ borderTop: '1px solid var(--nx-color-border)' }}>
                  <td style={{ padding: 10 }}>{localName(g.name, locale)}</td>
                  <td style={{ padding: 10, textAlign: 'end' }}>
                    <GhostButton onClick={() => addMember(g.id)}>{t('groups.add_member')}</GhostButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </>
  );
}
