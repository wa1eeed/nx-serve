import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '../../../lib/i18n';
import { buildMetadata } from '../../../lib/seo';
import { CtaBand, UseCaseTeaser } from '../../../components/sections';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ar = locale === 'ar';
  return buildMetadata({
    locale,
    path: '/use-cases',
    title: ar ? 'حالات الاستخدام | NX Serve' : 'Use cases | NX Serve',
    description: ar
      ? 'قوالب جاهزة لكل خدمة: السطحات، اللوجستيات والتوصيل، والمزيد. ابدأ من قالب ثم خصّصه بالكامل.'
      : 'Ready templates for every service: towing, logistics and delivery, and more. Start from a template, then configure it fully.',
  });
}

export default async function UseCasesPage({ params }: { params: Promise<{ locale: string }> }): Promise<ReactNode> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l: Locale = locale;
  return (
    <div style={{ paddingTop: 40 }}>
      <UseCaseTeaser locale={l} />
      <CtaBand locale={l} />
    </div>
  );
}
