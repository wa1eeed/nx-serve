import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Block, Guide } from '../lib/guides';
import { pick, type Locale } from '../lib/i18n';

const card = {
  border: '1px solid var(--nx-color-border)',
  borderRadius: 'var(--nx-radius-lg)',
  background: 'var(--nx-color-card)',
  padding: 22,
} as const;

export function GuideCard({ guide, locale }: { guide: Guide; locale: Locale }): ReactNode {
  return (
    <Link
      href={`/${locale}/guides/${guide.slug}`}
      style={{ ...card, display: 'block', textDecoration: 'none', color: 'var(--nx-color-foreground)' }}
    >
      <div style={{ fontSize: 12, color: 'var(--nx-color-primary)', marginBottom: 8 }}>
        {guide.type === 'howto' ? (locale === 'ar' ? 'دليل خطوة بخطوة' : 'Step by step') : locale === 'ar' ? 'مقالة' : 'Article'}
      </div>
      <h3 style={{ fontSize: 18, margin: '0 0 8px', lineHeight: 1.35 }}>{pick(guide.title, locale)}</h3>
      <p style={{ fontSize: 14, color: 'var(--nx-color-muted-foreground)', margin: 0, lineHeight: 1.6 }}>{pick(guide.dek, locale)}</p>
    </Link>
  );
}

function BlockView({ block, locale }: { block: Block; locale: Locale }): ReactNode {
  switch (block.kind) {
    case 'h2':
      return <h2 style={{ fontSize: 22, margin: '28px 0 10px' }}>{pick(block.text, locale)}</h2>;
    case 'p':
      return <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--nx-color-foreground)', margin: '0 0 14px' }}>{pick(block.text, locale)}</p>;
    case 'ul':
      return (
        <ul style={{ margin: '0 0 14px', paddingInlineStart: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pick(block.items, locale).map((item) => (
            <li key={item} style={{ fontSize: 16, lineHeight: 1.6 }}>
              {item}
            </li>
          ))}
        </ul>
      );
    case 'steps':
      return (
        <ol style={{ margin: '0 0 14px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pick(block.items, locale).map((item, i) => (
            <li
              key={item}
              style={{
                display: 'flex',
                gap: 12,
                border: '1px solid var(--nx-color-border)',
                borderRadius: 'var(--nx-radius-md)',
                padding: 14,
              }}
            >
              <span style={{ color: 'var(--nx-color-primary)', fontWeight: 700 }}>{i + 1}</span>
              <span style={{ fontSize: 16, lineHeight: 1.6 }}>{item}</span>
            </li>
          ))}
        </ol>
      );
  }
}

export function GuideBody({ blocks, locale }: { blocks: Block[]; locale: Locale }): ReactNode {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} locale={locale} />
      ))}
    </>
  );
}
