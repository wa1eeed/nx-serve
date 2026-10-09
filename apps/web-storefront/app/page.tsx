import { headers } from 'next/headers';
import type { ReactNode } from 'react';

/**
 * The storefront is resolved by host (tenant_domains). This Phase 0 shell shows
 * the resolved host and applies the design tokens; full ordering, "My account"
 * and the provider portal arrive in Phase 4 (docs/23). At runtime it will call
 * GET /v1/app/bootstrap to theme itself per tenant.
 */
export default async function Home(): Promise<ReactNode> {
  const host = (await headers()).get('host') ?? 'unknown';
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '64px 20px' }}>
      <h1>متجر الخدمة</h1>
      <p style={{ color: 'var(--nx-color-muted-foreground)' }}>
        يُحَل المستأجر من اسم المضيف الحالي:
        <bdi
          style={{
            direction: 'ltr',
            unicodeBidi: 'isolate',
            marginInlineStart: 8,
            padding: '2px 8px',
            borderRadius: 'var(--nx-radius-sm)',
            background: 'var(--nx-color-muted)',
          }}
        >
          {host}
        </bdi>
      </p>
      <p style={{ marginTop: 24, fontSize: 13, color: 'var(--nx-color-muted-foreground)' }}>
        هيكل المرحلة 0. الطلب والدفع والتتبّع و"حسابي" وبوابة المزوّد في المرحلة 4.
      </p>
    </main>
  );
}
