import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { GUIDES, findGuide } from '../../../../lib/guides';
import { SITE, isLocale, pick, type Locale } from '../../../../lib/i18n';
import { articleLd, breadcrumbLd, buildMetadata, faqLd, howToLd } from '../../../../lib/seo';
import { CtaBand, FaqList } from '../../../../components/sections';
import { Container } from '../../../../components/site';
import { GuideBody } from '../../../../components/guides-ui';
import { JsonLd } from '../../../../components/jsonld';

export function generateStaticParams(): { slug: string }[] {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const guide = findGuide(slug);
  if (!guide) return {};
  return buildMetadata({
    locale,
    path: `/guides/${slug}`,
    title: `${pick(guide.title, locale)} | NX Serve`,
    description: pick(guide.description, locale),
  });
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<ReactNode> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const l: Locale = locale;
  const guide = findGuide(slug);
  if (!guide) notFound();

  const howTo = howToLd(guide, l);
  const ld = [
    articleLd(guide, l),
    faqLd(guide.faq, l),
    breadcrumbLd([
      { name: SITE.name, path: `/${l}` },
      { name: l === 'ar' ? 'الأدلة' : 'Guides', path: `/${l}/guides` },
      { name: pick(guide.title, l), path: `/${l}/guides/${slug}` },
    ]),
    ...(howTo ? [howTo] : []),
  ];

  const dateLabel = new Intl.DateTimeFormat(l === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'long' }).format(
    new Date(guide.datePublished),
  );

  return (
    <>
      <JsonLd data={ld} />
      <article style={{ padding: '56px 0 8px' }}>
        <Container style={{ maxWidth: 760 }}>
          <h1 style={{ fontSize: 36, lineHeight: 1.2, margin: '0 0 12px' }}>{pick(guide.title, l)}</h1>
          <p style={{ fontSize: 19, color: 'var(--nx-color-muted-foreground)', margin: '0 0 12px', lineHeight: 1.6 }}>{pick(guide.dek, l)}</p>
          <div style={{ fontSize: 13, color: 'var(--nx-color-muted-foreground)', marginBottom: 28 }}>
            {pick(guide.author, l)} · {dateLabel}
          </div>
          <GuideBody blocks={guide.blocks} locale={l} />
        </Container>
      </article>
      <FaqList faqs={guide.faq} locale={l} />
      <CtaBand locale={l} />
    </>
  );
}
