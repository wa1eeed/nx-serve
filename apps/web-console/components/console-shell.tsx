'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEFAULT_LOCALE, LocaleContext, dirFor, translate, type Locale } from '../lib/i18n';

const NAV: { href: string; key: string }[] = [
  { href: '/', key: 'nav.dashboard' },
  { href: '/catalog/verticals', key: 'nav.verticals' },
  { href: '/settings', key: 'nav.settings' },
];

export function ConsoleShell({ children }: { children: ReactNode }): ReactNode {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const pathname = usePathname();

  // Restore the chosen locale (per viewer convenience only) and keep the document
  // direction in sync so RTL is a real layout, not a mirror.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('nx_locale');
      if (saved === 'ar' || saved === 'en') setLocale(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
  }, [locale]);

  const toggle = (): void => {
    const next: Locale = locale === 'ar' ? 'en' : 'ar';
    setLocale(next);
    try {
      window.localStorage.setItem('nx_locale', next);
    } catch {
      /* ignore */
    }
  };

  const t = (key: string): string => translate(locale, key);

  return (
    <LocaleContext.Provider value={locale}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            borderInlineEnd: '1px solid var(--nx-color-border)',
            background: 'var(--nx-color-card)',
            padding: '20px 14px',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18, padding: '0 8px 16px' }}>{t('app.title')}</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 'var(--nx-radius-md)',
                    textDecoration: 'none',
                    fontSize: 14,
                    color: active ? 'var(--nx-color-primary-foreground)' : 'var(--nx-color-foreground)',
                    background: active ? 'var(--nx-color-primary)' : 'transparent',
                  }}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <header
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: '12px 24px',
              borderBottom: '1px solid var(--nx-color-border)',
            }}
          >
            <button
              type="button"
              onClick={toggle}
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--nx-radius-md)',
                border: '1px solid var(--nx-color-border)',
                background: 'var(--nx-color-card)',
                color: 'var(--nx-color-foreground)',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              {t('common.language')}
            </button>
          </header>
          <main style={{ flex: 1, padding: '32px 24px', maxWidth: 960 }}>{children}</main>
        </div>
      </div>
    </LocaleContext.Provider>
  );
}
