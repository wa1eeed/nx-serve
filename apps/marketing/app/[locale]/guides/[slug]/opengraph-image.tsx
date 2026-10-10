import { GUIDES, findGuide } from '../../../../lib/guides';
import { isLocale, pick, type Locale } from '../../../../lib/i18n';
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from '../../../../lib/og';

export const alt = 'NX Serve guide';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Only prerendered images exist; nothing is rendered on demand at runtime.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Response> {
  const { locale, slug } = await params;
  const l: Locale = isLocale(locale) ? locale : 'en';
  const guide = findGuide(slug);
  return renderOg({
    title: guide ? pick(guide.title, l) : l === 'ar' ? 'الأدلة' : 'Guides',
    kicker: l === 'ar' ? 'دليل' : 'Guide',
    locale: l,
  });
}
