import { Injectable } from '@nestjs/common';
import {
  type EffectiveEntitlements,
  type EntitlementAddon,
  type EntitlementOverride,
  type ModuleDef,
  resolveEntitlements,
} from '@nxserve/domain';
import { DbService } from '../db/db.service.js';
import { RedisService } from '../redis/redis.service.js';

const CACHE_TTL_SECONDS = 300;

/**
 * Resolves and caches a tenant's effective entitlements (docs/10). Reads the
 * active plan version, its modules and limits, add-ons, overrides and the module
 * catalog, then runs the pure resolver. Cached in Redis, invalidated by events.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
  ) {}

  async getEffectiveModules(tenantId: string): Promise<Set<string>> {
    const key = `nx:ent:${tenantId}`;
    try {
      const cached = await this.redis.client.get(key);
      if (cached) return new Set(JSON.parse(cached) as string[]);
    } catch {
      // Cache miss or Redis unavailable: fall through to a fresh load.
    }
    const effective = await this.load(tenantId);
    const modules = [...effective.modules];
    try {
      await this.redis.client.set(key, JSON.stringify(modules), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // Best effort cache.
    }
    return effective.modules;
  }

  async invalidate(tenantId: string): Promise<void> {
    try {
      await this.redis.client.del(`nx:ent:${tenantId}`);
    } catch {
      // Best effort.
    }
  }

  private async load(tenantId: string): Promise<EffectiveEntitlements> {
    const moduleCatalog = await this.loadModuleCatalog();

    let planModules: string[] = [];
    const planLimits: Record<string, number | null> = {};
    let allServiceModules = false;

    const sub = await this.db.admin.query<{ plan_version_id: string }>(
      `SELECT plan_version_id FROM tenant_subscriptions
       WHERE tenant_id = $1 AND status = 'active' ORDER BY period_end DESC LIMIT 1`,
      [tenantId],
    );
    const planVersionId = sub.rows[0]?.plan_version_id;
    if (planVersionId) {
      const pv = await this.db.admin.query<{ all_service_modules: boolean }>(
        `SELECT all_service_modules FROM plan_versions WHERE id = $1`,
        [planVersionId],
      );
      allServiceModules = pv.rows[0]?.all_service_modules ?? false;
      const pm = await this.db.admin.query<{ code: string }>(
        `SELECT m.code FROM plan_modules pm JOIN modules m ON m.id = pm.module_id WHERE pm.plan_version_id = $1`,
        [planVersionId],
      );
      planModules = pm.rows.map((r) => r.code);
      const pl = await this.db.admin.query<{ limit_code: string; value: number | null }>(
        `SELECT limit_code, value FROM plan_limits WHERE plan_version_id = $1`,
        [planVersionId],
      );
      for (const r of pl.rows) planLimits[r.limit_code] = r.value;
    }

    const addonRows = await this.db.admin.query<{
      module_code: string | null;
      limit_code: string | null;
      limit_delta: number | null;
      quantity: number | null;
    }>(
      `SELECT m.code AS module_code, ap.limit_code, ap.limit_delta, ta.quantity
       FROM tenant_addons ta JOIN addon_products ap ON ap.id = ta.addon_id
       LEFT JOIN modules m ON m.id = ap.module_id
       WHERE ta.tenant_id = $1 AND (ta.ends_at IS NULL OR ta.ends_at > now())`,
      [tenantId],
    );
    const addons: EntitlementAddon[] = addonRows.rows.map((r) => ({
      ...(r.module_code !== null ? { moduleCode: r.module_code } : {}),
      ...(r.limit_code !== null ? { limitCode: r.limit_code } : {}),
      ...(r.limit_delta !== null ? { limitDelta: r.limit_delta } : {}),
      quantity: r.quantity ?? 1,
    }));

    const overrideRows = await this.db.admin.query<{
      module_code: string | null;
      enabled: boolean | null;
      limit_code: string | null;
      value: number | null;
      expires_at: Date | null;
    }>(
      `SELECT m.code AS module_code, teo.enabled, teo.limit_code, teo.value, teo.expires_at
       FROM tenant_entitlement_overrides teo LEFT JOIN modules m ON m.id = teo.module_id
       WHERE teo.tenant_id = $1`,
      [tenantId],
    );
    const overrides: EntitlementOverride[] = overrideRows.rows.map((r) => ({
      ...(r.module_code !== null ? { moduleCode: r.module_code } : {}),
      ...(r.enabled !== null ? { enabled: r.enabled } : {}),
      ...(r.limit_code !== null ? { limitCode: r.limit_code } : {}),
      ...(r.value !== null ? { value: r.value } : {}),
      ...(r.expires_at !== null ? { expiresAt: r.expires_at } : {}),
    }));

    return resolveEntitlements({
      plan: { modules: planModules, limits: planLimits, allServiceModules },
      addons,
      overrides,
      moduleCatalog,
    });
  }

  private async loadModuleCatalog(): Promise<ModuleDef[]> {
    const mods = await this.db.admin.query<{ id: string; code: string; kind: 'service' | 'capability' }>(
      `SELECT id, code, kind FROM modules`,
    );
    const deps = await this.db.admin.query<{ module_id: string; requires: string; is_hard: boolean }>(
      `SELECT md.module_id, mm.code AS requires, md.is_hard
       FROM module_dependencies md JOIN modules mm ON mm.id = md.requires_id`,
    );
    const byId = new Map<string, ModuleDef & { id: string }>();
    for (const m of mods.rows) byId.set(m.id, { id: m.id, code: m.code, kind: m.kind, dependencies: [] });
    for (const d of deps.rows) {
      byId.get(d.module_id)?.dependencies?.push({ requires: d.requires, hard: d.is_hard });
    }
    return [...byId.values()].map((m) => ({ code: m.code, kind: m.kind, dependencies: m.dependencies ?? [] }));
  }
}
