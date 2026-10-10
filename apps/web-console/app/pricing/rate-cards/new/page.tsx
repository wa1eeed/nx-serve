'use client';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiSend } from '../../../../lib/api';
import { useLocale, useT } from '../../../../lib/i18n';
import { PageHeader } from '../../../../components/page-parts';
import { useSubmit } from '../../../../components/forms';
import { RateCardForm } from '../../../../components/rate-card-form';

export default function NewRateCardPage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const submit = useSubmit();

  const create = (body: Record<string, unknown>): void => {
    void submit.run(async () => {
      const created = await apiSend<{ id: string }>('POST', '/admin/pricing/rate-cards', body, locale);
      router.push(`/pricing/rate-cards/${created.id}`);
    });
  };

  return (
    <>
      <PageHeader title={t('rc.new')} intro={t('lc.four_eyes')} />
      <RateCardForm submit={create} submitState={submit.state} />
    </>
  );
}
