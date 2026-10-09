import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'NX Serve Developers',
  description: 'NX Serve API reference, guides, Postman collection and SDK.',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
