import type { MetadataRoute } from 'next';
import { SITE } from '../lib/i18n';

/** Marketing and docs content is crawlable, including by AI crawlers (docs/22 section 6). */
export default function robots(): MetadataRoute.Robots {
  const aiBots = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot'];
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      ...aiBots.map((userAgent) => ({ userAgent, allow: '/' })),
    ],
    sitemap: `${SITE.baseUrl}/sitemap.xml`,
    host: SITE.baseUrl,
  };
}
