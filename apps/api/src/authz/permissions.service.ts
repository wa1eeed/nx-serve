import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service.js';
import { RedisService } from '../redis/redis.service.js';

const CACHE_TTL_SECONDS = 300;

/** Resolves and caches a staff user's permission codes (docs/10). */
@Injectable()
export class PermissionsService {
  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
  ) {}

  async getPermissions(tenantId: string, staffUserId: string): Promise<Set<string>> {
    const key = `nx:perm:${tenantId}:${staffUserId}`;
    try {
      const cached = await this.redis.client.get(key);
      if (cached) return new Set(JSON.parse(cached) as string[]);
    } catch {
      // Fall through.
    }
    const res = await this.db.admin.query<{ permission_code: string }>(
      `SELECT DISTINCT rp.permission_code
       FROM user_role_assignments ura JOIN role_permissions rp ON rp.role_id = ura.role_id
       WHERE ura.user_id = $1`,
      [staffUserId],
    );
    const perms = res.rows.map((r) => r.permission_code);
    try {
      await this.redis.client.set(key, JSON.stringify(perms), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // Best effort.
    }
    return new Set(perms);
  }

  async invalidate(tenantId: string, staffUserId: string): Promise<void> {
    try {
      await this.redis.client.del(`nx:perm:${tenantId}:${staffUserId}`);
    } catch {
      // Best effort.
    }
  }
}
