import '@nxserve/design-tokens/tokens.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { LOCALES, SITE, dir, isLocale } from '../../lib/i18n';
import { SiteFooter, SiteHeader } from '../../components/site';
import { Analytics } from '../../components/analytics';
import { ConsentBanner } from '../../components/consent-banner';

// Resolves relative Open Graph and Twitter image URLs to the real origin.
export const metadata: Metadata = { metadataBase: new URL(SITE.baseUrl) };

export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} dir={dir(locale)}>
      <body
        style={{
          margin: 0,
          background: 'var(--nx-color-background)',
          color: 'var(--nx-color-foreground)',
          fontFamily: 'var(--nx-font-sans)',
        }}
      >
        <SiteHeader locale={locale} />
        <main>{children}</main>
        <SiteFooter locale={locale} />
        <ConsentBanner locale={locale} />
        <Analytics />
      </body>
    </html>
  );
}
