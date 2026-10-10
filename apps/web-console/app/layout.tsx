import '@nxserve/design-tokens/tokens.css';
import type { ReactNode } from 'react';
import { ConsoleShell } from '../components/console-shell';

export const metadata = { title: 'NX Serve Console' };

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  // dir/lang are set on the client by ConsoleShell once the locale is resolved;
  // the server render uses the Arabic default so first paint is already RTL.
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
        <ConsoleShell>{children}</ConsoleShell>
      </body>
    </html>
  );
}
