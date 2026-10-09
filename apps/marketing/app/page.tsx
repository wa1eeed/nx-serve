import type { ReactNode } from 'react';

export default function Home(): ReactNode {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '64px 20px' }}>
      <span
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: 'var(--nx-radius-md)',
          background: 'var(--nx-color-accent)',
          color: 'var(--nx-color-accent-foreground)',
          fontSize: 13,
        }}
      >
        Towing first, not towing only
      </span>
      <h1 style={{ fontSize: 48, lineHeight: 1.1, margin: '16px 0' }}>
        Launch your own field services platform
      </h1>
      <p style={{ fontSize: 18, color: 'var(--nx-color-muted-foreground)', maxWidth: 640 }}>
        NX Serve is a configurable, multi-tenant, white-label platform for on-demand and scheduled
        services in Saudi Arabia, built on Moyasar split payments with live tracking and a developer
        API. Towing first, then any service by configuration.
      </p>
      <p style={{ marginTop: 24 }}>
        <a href="/en" style={{ color: 'var(--nx-color-primary)' }}>
          Use cases
        </a>
        {'  ·  '}
        <a href="http://localhost:3005" style={{ color: 'var(--nx-color-primary)' }}>
          Developers
        </a>
      </p>
      <p style={{ marginTop: 48, fontSize: 13, color: 'var(--nx-color-muted-foreground)' }}>
        Phase 0 shell. Full marketing site, SEO, AEO and GEO follow in Phase 1 (docs/22).
      </p>
    </main>
  );
}
