'use client';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiSend } from '../../../../lib/api';
import { useLocale, useT } from '../../../../lib/i18n';
import { PageHeader } from '../../../../components/page-parts';
import { useSubmit } from '../../../../components/forms';
import { FeeScheduleForm } from '../../../../components/fee-schedule-form';

export default function NewFeeSchedulePage(): ReactNode {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const submit = useSubmit();

  const create = (body: Record<string, unknown>): void => {
    void submit.run(async () => {
      const created = await apiSend<{ id: string }>('POST', '/admin/pricing/fee-schedules', body, locale);
      router.push(`/pricing/fee-schedules/${created.id}`);
    });
  };

  return (
    <>
      <PageHeader title={t('fs.new')} intro={t('lc.four_eyes')} />
      <FeeScheduleForm submit={create} submitState={submit.state} />
    </>
  );
}
