import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '../../../lib/i18n';
import { buildMetadata, organizationLd } from '../../../lib/seo';
import { CtaBand, FeatureGrid } from '../../../components/sections';
import { JsonLd } from '../../../components/jsonld';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ar = locale === 'ar';
  return buildMetadata({
    locale,
    path: '/features',
    title: ar ? 'المزايا | NX Serve' : 'Features | NX Serve',
    description: ar
      ? 'محرّك التهيئة، التتبع الحيّ، التوزيع الذكي، التسعير الديناميكي، المدفوعات المقسّمة، ومنصة الواجهات البرمجية.'
      : 'Configuration engine, live tracking, smart dispatch, dynamic pricing, split payments and an API platform.',
  });
}

export default async function FeaturesPage({ params }: { params: Promise<{ locale: string }> }): Promise<ReactNode> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l: Locale = locale;
  return (
    <div style={{ paddingTop: 40 }}>
      <JsonLd data={organizationLd()} />
      <FeatureGrid locale={l} />
      <CtaBand locale={l} />
    </div>
  );
}
