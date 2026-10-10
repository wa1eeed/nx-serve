import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { USE_CASES, findUseCase } from '../../../../lib/content';
import { SITE, isLocale, pick, type Locale } from '../../../../lib/i18n';
import { breadcrumbLd, buildMetadata, faqLd } from '../../../../lib/seo';
import { CtaBand, FaqList, SectionHeading } from '../../../../components/sections';
import { Container } from '../../../../components/site';
import { JsonLd } from '../../../../components/jsonld';

export function generateStaticParams(): { slug: string }[] {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const uc = findUseCase(slug);
  if (!uc) return {};
  return buildMetadata({
    locale,
    path: `/use-cases/${slug}`,
    title: `${pick(uc.name, locale)} | NX Serve`,
    description: pick(uc.tagline, locale),
  });
}

const card = {
  border: '1px solid var(--nx-color-border)',
  borderRadius: 'var(--nx-radius-lg)',
  background: 'var(--nx-color-card)',
  padding: 22,
} as const;

export default async function UseCasePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<ReactNode> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const l: Locale = locale;
  const uc = findUseCase(slug);
  if (!uc) notFound();

  return (
    <>
      <JsonLd
        data={[
          faqLd(uc.faq, l),
          breadcrumbLd([
            { name: SITE.name, path: `/${l}` },
            { name: pick({ ar: 'حالات الاستخدام', en: 'Use cases' }, l), path: `/${l}/use-cases` },
            { name: pick(uc.name, l), path: `/${l}/use-cases/${slug}` },
          ]),
        ]}
      />
      <section style={{ padding: '56px 0 24px' }}>
        <Container>
          <h1 style={{ fontSize: 40, margin: '0 0 12px', lineHeight: 1.15 }}>{pick(uc.name, l)}</h1>
          <p style={{ fontSize: 19, color: 'var(--nx-color-muted-foreground)', maxWidth: 680, margin: 0 }}>{pick(uc.tagline, l)}</p>
        </Container>
      </section>

      <section style={{ padding: '16px 0' }}>
        <Container>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={card}>
              <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>{l === 'ar' ? 'التحدي' : 'The problem'}</h2>
              <p style={{ fontSize: 15, color: 'var(--nx-color-muted-foreground)', margin: 0, lineHeight: 1.65 }}>{pick(uc.pain, l)}</p>
            </div>
            <div style={card}>
              <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>{l === 'ar' ? 'وقت الإطلاق' : 'Launch time'}</h2>
              <p style={{ fontSize: 15, color: 'var(--nx-color-muted-foreground)', margin: 0 }}>{pick(uc.launchTime, l)}</p>
              <h2 style={{ fontSize: 18, margin: '16px 0 8px' }}>{l === 'ar' ? 'مثال التسعير' : 'Pricing example'}</h2>
              <p style={{ fontSize: 15, color: 'var(--nx-color-muted-foreground)', margin: 0, lineHeight: 1.65 }}>{pick(uc.pricingExample, l)}</p>
            </div>
          </div>
        </Container>
      </section>

      <section style={{ padding: '24px 0' }}>
        <Container>
          <SectionHeading title={l === 'ar' ? 'كيف تُدار على المنصة' : 'How the platform runs it'} />
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 12, listStyle: 'none', padding: 0, margin: 0, maxWidth: 760 }}>
            {pick(uc.how, l).map((step, i) => (
              <li key={i} style={{ ...card, display: 'flex', gap: 14 }}>
                <span style={{ color: 'var(--nx-color-primary)', fontWeight: 700 }}>{i + 1}</span>
                <span style={{ fontSize: 15, lineHeight: 1.6 }}>{step}</span>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <FaqList faqs={uc.faq} locale={l} />
      <CtaBand locale={l} />
    </>
  );
}
