import type { ReactNode } from 'react';

export default function Home(): ReactNode {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '64px 20px' }}>
      <h1>NX Serve Console</h1>
      <p style={{ color: 'var(--nx-color-muted-foreground)' }}>
        Tenant admin and provider portal in one role-aware app (docs/10, docs/23): branding,
        services, pricing, fees, dispatch, providers, memberships and reports. Phase 0 shell.
      </p>
    </main>
  );
}
