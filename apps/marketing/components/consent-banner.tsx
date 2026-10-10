'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { getConsent, setConsent } from '../lib/analytics';
import type { Locale } from '../lib/i18n';

const T = {
  ar: {
    text: 'نستخدم ملفات تعريف ارتباط أساسية لتشغيل الموقع، وملفات تحليلات اختيارية لتحسين تجربتك فقط بعد موافقتك.',
    accept: 'أوافق',
    decline: 'الأساسية فقط',
    privacy: 'سياسة الخصوصية',
  },
  en: {
    text: 'We use essential cookies to run the site, and optional analytics cookies only after you agree.',
    accept: 'Accept',
    decline: 'Essential only',
    privacy: 'Privacy policy',
  },
} as const;

/** PDPL consent banner (docs/22 section 7). Defaults to no analytics until accepted. */
export function ConsentBanner({ locale }: { locale: Locale }): ReactNode {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(getConsent() === null);
  }, []);

  if (!show) return null;
  const t = T[locale];

  const choose = (value: 'granted' | 'denied'): void => {
    setConsent(value);
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label={t.privacy}
      style={{
        position: 'fixed',
        insetInline: 0,
        bottom: 0,
        zIndex: 50,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 20px',
        background: 'var(--nx-color-card)',
        borderTop: '1px solid var(--nx-color-border)',
      }}
    >
      <p style={{ margin: 0, fontSize: 14, maxWidth: 640, color: 'var(--nx-color-foreground)' }}>
        {t.text}{' '}
        <Link href={`/${locale}/privacy`} style={{ color: 'var(--nx-color-primary)' }}>
          {t.privacy}
        </Link>
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={() => choose('denied')} style={ghost}>
          {t.decline}
        </button>
        <button type="button" onClick={() => choose('granted')} style={primary}>
          {t.accept}
        </button>
      </div>
    </div>
  );
}

const baseBtn = {
  padding: '8px 16px',
  borderRadius: 'var(--nx-radius-md)',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 600,
  fontSize: 14,
} as const;

const primary = {
  ...baseBtn,
  border: 'none',
  background: 'var(--nx-color-primary)',
  color: 'var(--nx-color-primary-foreground)',
} as const;

const ghost = {
  ...baseBtn,
  border: '1px solid var(--nx-color-border)',
  background: 'transparent',
  color: 'var(--nx-color-foreground)',
} as const;
