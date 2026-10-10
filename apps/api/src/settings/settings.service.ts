import { Injectable } from '@nestjs/common';
import { uuidv7 } from '@nxserve/domain';
import { resolveSetting, type SettingLevel, type SettingValueAtLevel } from '@nxserve/domain';
import { DbService } from '../db/db.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { AppException } from '../common/app-exception.js';
import { type Actor } from '../context/request-context.js';

interface DefRow {
  key: string;
  default_value: unknown;
  editable_levels: string[];
}
interface ValRow {
  key: string;
  level: SettingLevel;
  value: unknown;
  min_value: number | null;
  max_value: number | null;
  is_locked: boolean;
}

/** Hierarchical settings read and tenant-level writes (docs/10 section 8). */
@Injectable()
export class SettingsService {
  constructor(
    private readonly db: DbService,
    private readonly outbox: OutboxService,
  ) {}

  /** Effective settings for the tenant (platform and tenant levels resolved). */
  async getEffective(tenantId: string): Promise<Record<string, unknown>> {
    return this.db.withTenant(tenantId, async (client) => {
      const defs = await client.query<DefRow>(
        `SELECT key, default_value, editable_levels FROM setting_definitions`,
      );
      const vals = await client.query<ValRow>(
        `SELECT key, level, value, min_value, max_value, is_locked
         FROM setting_values WHERE level IN ('platform', 'tenant')`,
      );
      const byKey = new Map<string, ValRow[]>();
      for (const v of vals.rows) {
        const list = byKey.get(v.key) ?? [];
        list.push(v);
        byKey.set(v.key, list);
      }
      const out: Record<string, unknown> = {};
      for (const def of defs.rows) {
        const levels: SettingValueAtLevel[] = (byKey.get(def.key) ?? []).map((v) => ({
          level: v.level,
          value: v.value,
          min: v.min_value,
          max: v.max_value,
          locked: v.is_locked,
        }));
        out[def.key] = resolveSetting({ defaultValue: def.default_value }, levels);
      }
      return out;
    });
  }

  async upsertTenantValue(
    tenantId: string,
    key: string,
    value: unknown,
    actor: Actor,
  ): Promise<{ key: string; value: unknown }> {
    return this.db.withTenant(tenantId, async (client) => {
      const def = await client.query<DefRow>(
        `SELECT key, default_value, editable_levels FROM setting_definitions WHERE key = $1`,
        [key],
      );
      const d = def.rows[0];
      if (!d) {
        throw new AppException('not_found', { detail: `Unknown setting ${key}` });
      }
      if (!d.editable_levels.includes('tenant')) {
        throw new AppException('forbidden', { detail: 'Setting is not editable at the tenant level' });
      }
      const platform = await client.query<ValRow>(
        `SELECT is_locked FROM setting_values WHERE key = $1 AND level = 'platform'`,
        [key],
      );
      if (platform.rows[0]?.is_locked) {
        throw new AppException('forbidden', { detail: 'Setting is locked by the platform' });
      }
      await client.query(
        `INSERT INTO setting_values (id, key, level, owner_id, tenant_id, value, updated_at)
         VALUES ($1, $2, 'tenant', $3, $3, $4::jsonb, now())
         ON CONFLICT (key, level, owner_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [uuidv7(), key, tenantId, JSON.stringify(value ?? null)],
      );
      await this.outbox.emit(client, { type: 'settings.updated', tenantId, actor, data: { key } });
      return { key, value };
    });
  }
}
