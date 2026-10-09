import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createPool, withTenant, type PgPool, type PoolClient } from '@nxserve/db';
import { ConfigService } from '../config/config.service.js';

export interface TenantRow {
  id: string;
  slug: string;
  displayName: string;
  defaultLocale: string;
  supportedLocales: string[];
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
}

/**
 * Database access for the API. The `app` pool is the non owner role (RLS
 * enforced); every tenant query runs through `withTenant`, which opens a
 * transaction and sets app.tenant_id via SET LOCAL. The `admin` pool (BYPASSRLS)
 * is used only for cross tenant lookups such as resolving a tenant from a host.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  readonly app: PgPool = createPool('app');
  readonly admin: PgPool = createPool('superadmin');

  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    await this.app.end();
    await this.admin.end();
  }

  /** Runs `fn` inside a tenant scoped transaction (RLS active). */
  withTenant<T>(tenantId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return withTenant(this.app, tenantId, fn);
  }

  /** Liveness of the database using the app pool. */
  async ping(): Promise<void> {
    await this.app.query('SELECT 1');
  }

  /** Resolves a tenant from a request host (exact domain, then slug subdomain). */
  async resolveTenantByHost(host: string): Promise<TenantRow | null> {
    const hostname = host.split(':')[0]?.toLowerCase() ?? '';
    if (hostname === '') return null;

    const byDomain = await this.admin.query<TenantRowRaw>(
      `SELECT t.id, t.slug, t.display_name, t.default_locale, t.supported_locales, t.branding, t.settings
       FROM tenant_domains d JOIN tenants t ON t.id = d.tenant_id
       WHERE d.hostname = $1 LIMIT 1`,
      [hostname],
    );
    if (byDomain.rows.length > 0) return mapTenant(byDomain.rows[0]);

    // Fall back to <slug>.<platform-domain> or <slug>.<staging-domain>.
    const bases = [this.config.platformDomain, this.config.stagingDomain].filter((b) => b !== '');
    for (const base of bases) {
      const suffix = `.${base}`;
      if (hostname.endsWith(suffix)) {
        const slug = hostname.slice(0, -suffix.length);
        const bySlug = await this.admin.query<TenantRowRaw>(
          `SELECT id, slug, display_name, default_locale, supported_locales, branding, settings
           FROM tenants WHERE slug = $1 LIMIT 1`,
          [slug],
        );
        if (bySlug.rows.length > 0) return mapTenant(bySlug.rows[0]);
      }
    }
    return null;
  }
}

interface TenantRowRaw {
  id: string;
  slug: string;
  display_name: string;
  default_locale: string;
  supported_locales: string[];
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
}

function mapTenant(row: TenantRowRaw): TenantRow {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    defaultLocale: row.default_locale,
    supportedLocales: row.supported_locales,
    branding: row.branding,
    settings: row.settings,
  };
}
