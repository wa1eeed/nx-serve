import { Injectable } from '@nestjs/common';
import { uuidv7 } from '@nxserve/domain';
import { DbService } from '../db/db.service.js';
import { type Actor } from '../context/request-context.js';

export interface AuditEntry {
  tenantId?: string;
  actor: Actor;
  action: string;
  entity: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Records admin and money affecting actions to audit_logs. Uses the super admin
 * pool so platform (tenant NULL) actions are captured and the write is never
 * blocked by RLS; the row still carries the acting tenant when there is one.
 */
@Injectable()
export class AuditService {
  constructor(private readonly db: DbService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.admin.query(
      `INSERT INTO audit_logs (id, tenant_id, actor_type, actor_id, action, entity, entity_id, before, after, ip, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, now())`,
      [
        uuidv7(),
        entry.tenantId ?? null,
        entry.actor.type,
        entry.actor.id ?? null,
        entry.action,
        entry.entity,
        entry.entityId ?? null,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        entry.ip ?? null,
        entry.userAgent ?? null,
      ],
    );
  }
}
