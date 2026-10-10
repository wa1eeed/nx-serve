import { ImageResponse } from 'next/og';

/**
 * Branded Open Graph / Twitter card generator (docs/22 section 4). Rendered with
 * next/og (satori), which does not resolve CSS variables or ship an Arabic font,
 * so colors are the design-token hex values and the card text is the Latin brand
 * plus the English title. The localized og:title and og:description still come
 * from each page's metadata.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const C = {
  bg: '#0b0b0f',
  fg: '#e7e7ea',
  muted: '#9a9aa6',
  primary: '#6c6cf0',
  accent: '#c7d2fe',
  border: '#23232b',
};

export function renderOg({ title, kicker }: { title: string; kicker?: string }): ImageResponse {
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
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: C.primary }} />
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -0.5 }}>NX Serve</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {kicker ? (
            <div style={{ fontSize: 28, color: C.accent, textTransform: 'uppercase', letterSpacing: 2 }}>{kicker}</div>
          ) : null}
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.1, maxWidth: 980 }}>{title}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 26, color: C.muted }}>
          <div style={{ width: 56, height: 4, background: C.primary, borderRadius: 2 }} />
          White-label field services platform, Saudi Arabia
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
