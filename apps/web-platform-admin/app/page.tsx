import type { ReactNode } from 'react';

export default function Home(): ReactNode {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '64px 20px' }}>
      <h1>NX Serve Platform Admin</h1>
      <p style={{ color: 'var(--nx-color-muted-foreground)' }}>
        Super admin for NX staff: tenants, plans, modules, entitlements, licence billing, global
        catalogs and monitoring (docs/10). Phase 0 shell; screens arrive in Phases 1 and 7.
      </p>
    </main>
  );
}
