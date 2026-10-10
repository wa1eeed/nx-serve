import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { NAV, ENTITY } from '../lib/content';
import { SITE, pick, type Locale } from '../lib/i18n';
import { LocaleSwitch } from './locale-switch';

export function Container({ children, style }: { children: ReactNode; style?: CSSProperties }): ReactNode {
  return <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 20px', ...style }}>{children}</div>;
}

export function Btn({
  href,
  variant = 'primary',
  children,
}: {
  href: string;
  variant?: 'primary' | 'ghost';
  children: ReactNode;
}): ReactNode {
  const primary = variant === 'primary';
  return (
    <Link
      href={href}
      style={{
        display: 'inline-block',
        padding: '11px 20px',
        borderRadius: 'var(--nx-radius-md)',
        fontWeight: 600,
        fontSize: 15,
        textDecoration: 'none',
        background: primary ? 'var(--nx-color-primary)' : 'transparent',
        color: primary ? 'var(--nx-color-primary-foreground)' : 'var(--nx-color-foreground)',
        border: primary ? 'none' : '1px solid var(--nx-color-border)',
      }}
    >
      {children}
    </Link>
  );
}

export function SiteHeader({ locale }: { locale: Locale }): ReactNode {
  return (
    <header style={{ borderBottom: '1px solid var(--nx-color-border)', position: 'sticky', top: 0, background: 'var(--nx-color-background)', zIndex: 10 }}>
      <Container style={{ display: 'flex', alignItems: 'center', gap: 20, height: 64 }}>
        <Link href={`/${locale}`} style={{ fontWeight: 800, fontSize: 18, color: 'var(--nx-color-foreground)', textDecoration: 'none' }}>
          {SITE.name}
        </Link>
        <nav style={{ display: 'flex', gap: 18, flex: 1, flexWrap: 'wrap' }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              style={{ fontSize: 14, color: 'var(--nx-color-muted-foreground)', textDecoration: 'none' }}
            >
              {pick(item.label, locale)}
            </Link>
          ))}
          <a href={SITE.developersUrl} style={{ fontSize: 14, color: 'var(--nx-color-muted-foreground)', textDecoration: 'none' }}>
            {locale === 'ar' ? 'المطورون' : 'Developers'}
          </a>
        </nav>
        <LocaleSwitch locale={locale} />
        <Btn href={`/${locale}/demo`}>{locale === 'ar' ? 'اطلب عرضاً' : 'Book a demo'}</Btn>
      </Container>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: Locale }): ReactNode {
  const year = new Date().getFullYear();
  return (
    <footer style={{ borderTop: '1px solid var(--nx-color-border)', marginTop: 80, padding: '40px 0', color: 'var(--nx-color-muted-foreground)' }}>
      <Container style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontWeight: 700, color: 'var(--nx-color-foreground)' }}>{SITE.name}</div>
        <p style={{ margin: 0, maxWidth: 640, fontSize: 14 }}>{pick(ENTITY, locale)}</p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14 }}>
          {NAV.map((item) => (
            <Link key={item.href} href={`/${locale}${item.href}`} style={{ color: 'var(--nx-color-muted-foreground)', textDecoration: 'none' }}>
              {pick(item.label, locale)}
            </Link>
          ))}
          <a href={`mailto:${SITE.email}`} style={{ color: 'var(--nx-color-muted-foreground)', textDecoration: 'none' }}>
            {SITE.email}
          </a>
        </div>
        <div style={{ fontSize: 13 }}>
          © {year} {SITE.company}. {locale === 'ar' ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
        </div>
      </Container>
    </footer>
  );
}
