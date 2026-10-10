export type Locale = 'ar' | 'en';

export const LOCALES: Locale[] = ['ar', 'en'];
export const DEFAULT_LOCALE: Locale = 'ar';

export function isLocale(value: string): value is Locale {
  return value === 'ar' || value === 'en';
}

export function dir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** The OpenGraph locale tag for a locale (BCP 47 to OG format). */
export function ogLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar_SA' : 'en_US';
}

/** A bilingual value; `pick` resolves it to the active locale. */
export type L<T> = { ar: T; en: T };
export function pick<T>(value: L<T>, locale: Locale): T {
  return value[locale];
}

export const SITE = {
  name: 'NX Serve',
  // The site origin, used for canonical URLs, hreflang, sitemap and JSON-LD.
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nxserve.com',
  developersUrl: process.env.NEXT_PUBLIC_DEVELOPERS_URL ?? 'https://developers.nxserve.com',
  company: 'NX Solutions',
  email: 'hello@nxserve.com',
} as const;
