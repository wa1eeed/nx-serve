import '@nxserve/design-tokens/tokens.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'NX Serve Platform Admin' };

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
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
