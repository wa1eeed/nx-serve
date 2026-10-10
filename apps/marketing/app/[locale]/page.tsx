import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { HERO, HOME_FAQ } from '../../lib/content';
import { isLocale, pick, type Locale } from '../../lib/i18n';
import { buildMetadata, faqLd, organizationLd, softwareApplicationLd, websiteLd } from '../../lib/seo';
import { CtaBand, FaqList, FeatureGrid, Hero, Steps, TrustBar, UseCaseTeaser } from '../../components/sections';
import { CalculatorSection } from '../../components/revenue-calculator';
import { JsonLd } from '../../components/jsonld';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: '',
    title: `${pick(HERO.title, locale)} | NX Serve`,
    description: pick(HERO.subtitle, locale),
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }): Promise<ReactNode> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l: Locale = locale;
  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd(), softwareApplicationLd(l), faqLd(HOME_FAQ, l)]} />
      <Hero locale={l} />
      <TrustBar locale={l} />
      <FeatureGrid locale={l} />
      <UseCaseTeaser locale={l} />
      <Steps locale={l} />
      <CalculatorSection locale={l} />
      <FaqList faqs={HOME_FAQ} locale={l} />
      <CtaBand locale={l} />
    </>
  );
}
