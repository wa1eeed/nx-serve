import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '../../../lib/i18n';
import { buildMetadata } from '../../../lib/seo';
import { CtaBand, Steps } from '../../../components/sections';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ar = locale === 'ar';
  return buildMetadata({
    locale,
    path: '/how-it-works',
    title: ar ? 'كيف يعمل | NX Serve' : 'How it works | NX Serve',
    description: ar
      ? 'سجّل، اختر قالباً، خصّص علامتك، اربط المدفوعات، ضمّ مقدّمي الخدمة، ثم أطلق.'
      : 'Sign up, choose a template, brand it, connect payments, onboard providers, then go live.',
  });
}

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }): Promise<ReactNode> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l: Locale = locale;
  return (
    <div style={{ paddingTop: 40 }}>
      <Steps locale={l} />
      <CtaBand locale={l} />
    </div>
  );
}
