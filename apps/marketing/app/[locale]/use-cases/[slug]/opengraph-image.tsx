import { USE_CASES, findUseCase } from '../../../../lib/content';
import { isLocale, pick, type Locale } from '../../../../lib/i18n';
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from '../../../../lib/og';

export const alt = 'NX Serve use case';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Only prerendered images exist; nothing is rendered on demand at runtime.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Response> {
  const { locale, slug } = await params;
  const l: Locale = isLocale(locale) ? locale : 'en';
  const uc = findUseCase(slug);
  return renderOg({
    title: uc ? pick(uc.name, l) : l === 'ar' ? 'حالات الاستخدام' : 'Use cases',
    kicker: l === 'ar' ? 'حالة استخدام' : 'Use case',
    locale: l,
  });
}
