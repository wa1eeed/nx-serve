import type { Metadata } from 'next';
import { ENTITY, HOME_FAQ, PLANS, type Faq } from './content';
import type { Guide } from './guides';
import { SITE, ogLocale, pick, type L, type Locale } from './i18n';

/** Builds per-page metadata with canonical and hreflang alternates (docs/22 section 4). */
export function buildMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: Locale;
  path: string; // without locale prefix, e.g. '' or '/pricing'
  title: string;
  description: string;
}): Metadata {
  const localized = (l: Locale): string => `/${l}${path}`;
  return {
    metadataBase: new URL(SITE.baseUrl),
    title,
    description,
    alternates: {
      canonical: localized(locale),
      languages: {
        'ar-SA': localized('ar'),
        en: localized('en'),
        'x-default': localized('ar'),
      },
    },
    openGraph: {
      title,
      description,
      url: localized(locale),
      siteName: SITE.name,
      locale: ogLocale(locale),
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

type Json = Record<string, unknown>;

export function organizationLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    legalName: SITE.company,
    url: SITE.baseUrl,
    email: SITE.email,
    description: ENTITY.en,
  };
}

export function websiteLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE.baseUrl}/en/use-cases?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function softwareApplicationLd(locale: Locale): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    description: pick(ENTITY, locale),
    offers: { '@type': 'AggregateOffer', priceCurrency: 'SAR', offerCount: PLANS.length },
  };
}

export function faqLd(faqs: Faq[], locale: Locale): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: pick(f.q, locale),
      acceptedAnswer: { '@type': 'Answer', text: pick(f.a, locale) },
    })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE.baseUrl}${item.path}`,
    })),
  };
}

export function plansLd(locale: Locale): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${SITE.name} ${locale === 'ar' ? 'الخطط' : 'plans'}`,
    description: pick(ENTITY, locale),
    offers: PLANS.map((p) => ({
      '@type': 'Offer',
      name: pick(p.name, locale),
      priceCurrency: 'SAR',
      category: 'subscription',
      description: pick(p.blurb, locale),
    })),
  };
}

export function articleLd(guide: Guide, locale: Locale): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: pick(guide.title, locale),
    description: pick(guide.description, locale),
    author: { '@type': 'Organization', name: pick(guide.author, locale) },
    publisher: { '@type': 'Organization', name: SITE.name },
    datePublished: guide.datePublished,
    dateModified: guide.dateModified,
    inLanguage: locale === 'ar' ? 'ar-SA' : 'en',
    mainEntityOfPage: `${SITE.baseUrl}/${locale}/guides/${guide.slug}`,
  };
}

/** HowTo schema from a guide's steps block, when present (docs/22 section 5). */
export function howToLd(guide: Guide, locale: Locale): Json | null {
  const steps = guide.blocks.find((b) => b.kind === 'steps');
  if (!steps || steps.kind !== 'steps') return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: pick(guide.title, locale),
    description: pick(guide.description, locale),
    step: pick(steps.items, locale).map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
  };
}

export const HOME_FAQ_LD = (locale: Locale): Json => faqLd(HOME_FAQ, locale);

export function resolveTitle(parts: L<string>, locale: Locale): string {
  return `${pick(parts, locale)} | ${SITE.name}`;
}
