import '@nxserve/design-tokens/tokens.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'NX Serve Storefront' };

// Saudi tenants default to Arabic and RTL (docs/21, docs/24). The real default
// locale is a tenant setting resolved at runtime.
export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          background: 'var(--nx-color-background)',
          color: 'var(--nx-color-foreground)',
          fontFamily: 'var(--nx-font-sans)',
        }}
      >
        {children}
      </body>
    </html>
  );
}
