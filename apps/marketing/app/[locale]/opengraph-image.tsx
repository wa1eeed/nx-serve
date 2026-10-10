import { HERO } from '../../lib/content';
import { LOCALES, isLocale, pick, type Locale } from '../../lib/i18n';
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from '../../lib/og';

export const alt = 'NX Serve';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Only prerendered images exist; nothing is rendered on demand at runtime.
export const dynamicParams = false;

export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }): Promise<Response> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : 'en';
  return renderOg({ title: pick(HERO.title, l), locale: l });
}
