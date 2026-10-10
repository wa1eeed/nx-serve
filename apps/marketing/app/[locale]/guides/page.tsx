import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { GUIDES } from '../../../lib/guides';
import { isLocale, type Locale } from '../../../lib/i18n';
import { buildMetadata } from '../../../lib/seo';
import { CtaBand, SectionHeading } from '../../../components/sections';
import { Container } from '../../../components/site';
import { GuideCard } from '../../../components/guides-ui';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ar = locale === 'ar';
  return buildMetadata({
    locale,
    path: '/guides',
    title: ar ? 'الأدلة | NX Serve' : 'Guides | NX Serve',
    description: ar
      ? 'أدلة عملية لإطلاق أعمال الخدمات عند الطلب في السعودية: السطحات، التوصيل، المدفوعات المقسّمة، والتسعير.'
      : 'Practical guides to launching on-demand service businesses in Saudi Arabia: towing, delivery, split payments and pricing.',
  });
}

export default async function GuidesPage({ params }: { params: Promise<{ locale: string }> }): Promise<ReactNode> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l: Locale = locale;
  return (
    <>
      <section style={{ padding: '48px 0 8px' }}>
        <Container>
          <SectionHeading
            title={l === 'ar' ? 'الأدلة' : 'Guides'}
            intro={l === 'ar' ? 'أدلة عملية لإطلاق خدمتك وإدارتها.' : 'Practical guides to launch and run your service.'}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {GUIDES.map((g) => (
              <GuideCard key={g.slug} guide={g} locale={l} />
            ))}
          </div>
        </Container>
      </section>
      <CtaBand locale={l} />
    </>
  );
}
