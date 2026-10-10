import { HERO } from '../../lib/content';
import { LOCALES } from '../../lib/i18n';
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from '../../lib/og';

export const alt = 'NX Serve';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export default function Image(): Response {
  return renderOg({ title: HERO.title.en });
}
