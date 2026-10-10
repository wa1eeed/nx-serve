import type { MetadataRoute } from 'next';
import { USE_CASES } from '../lib/content';
import { LOCALES, SITE } from '../lib/i18n';

const PATHS = ['', '/use-cases', '/features', '/how-it-works', '/pricing', ...USE_CASES.map((u) => `/use-cases/${u.slug}`)];

/** Sitemap with per-locale URLs and hreflang alternates (docs/22 section 4). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const path of PATHS) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE.baseUrl}/${locale}${path}`,
        lastModified: now,
        alternates: {
          languages: {
            'ar-SA': `${SITE.baseUrl}/ar${path}`,
            en: `${SITE.baseUrl}/en${path}`,
            'x-default': `${SITE.baseUrl}/ar${path}`,
          },
        },
      });
    }
  }
  return entries;
}
