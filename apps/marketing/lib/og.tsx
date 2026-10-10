import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { Locale } from './i18n';

/**
 * Branded Open Graph / Twitter card generator (docs/22 section 4). Rendered with
 * next/og (satori). It embeds IBM Plex Sans Arabic (the design-system font, which
 * also covers Latin), so the card shows the title in the page locale, Arabic
 * included. Colors are the design-token hex values since satori does not resolve
 * CSS variables.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const C = {
  bg: '#0b0b0f',
  fg: '#e7e7ea',
  muted: '#9a9aa6',
  primary: '#6c6cf0',
  accent: '#c7d2fe',
};

const FAMILY = 'IBM Plex Sans Arabic';

// Read once at module load. Every OG image is prerendered (all locales and slugs
// are in generateStaticParams), so this runs at build time with the app as cwd.
const fontDir = join(process.cwd(), 'assets', 'fonts');
const fontRegular = readFileSync(join(fontDir, 'IBMPlexSansArabic-Regular.ttf'));
const fontBold = readFileSync(join(fontDir, 'IBMPlexSansArabic-Bold.ttf'));

const TAGLINE: Record<Locale, string> = {
  ar: 'منصة خدمات ميدانية بعلامتك الخاصة، السعودية',
  en: 'White-label field services platform, Saudi Arabia',
};

export function renderOg({
  title,
  kicker,
  locale,
}: {
  title: string;
  kicker?: string;
  locale: Locale;
}): ImageResponse {
  const rtl = locale === 'ar';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: C.bg,
          color: C.fg,
          padding: 72,
          fontFamily: FAMILY,
          direction: rtl ? 'rtl' : 'ltr',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: rtl ? 'flex-end' : 'flex-start' }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: C.primary }} />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -0.5 }}>NX Serve</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: rtl ? 'flex-end' : 'flex-start', gap: 18 }}>
          {kicker ? (
            <div style={{ fontSize: 28, color: C.accent, letterSpacing: rtl ? 0 : 2 }}>{kicker}</div>
          ) : null}
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000, textAlign: rtl ? 'right' : 'left' }}>
            {title}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 26, color: C.muted, justifyContent: rtl ? 'flex-end' : 'flex-start' }}>
          <div style={{ width: 56, height: 4, background: C.primary, borderRadius: 2 }} />
          {TAGLINE[locale]}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: FAMILY, data: fontRegular, weight: 400, style: 'normal' },
        { name: FAMILY, data: fontBold, weight: 700, style: 'normal' },
      ],
    },
  );
}
