import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service.js';

export interface RoleSummary {
  id: string;
  scope: string;
  code: string;
  name: Record<string, string>;
  is_system: boolean;
}

export interface PermissionSummary {
  code: string;
  module_code: string | null;
  description: Record<string, string> | null;
}

/** Roles and permissions reads (docs/10). Roles are tenant or NX global templates. */
@Injectable()
export class RbacService {
  constructor(private readonly db: DbService) {}

  async listRoles(tenantId: string): Promise<RoleSummary[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<RoleSummary>(
        `SELECT id, scope, code, name, is_system FROM roles ORDER BY code`,
      );
      return res.rows;
    });
  }

  async listPermissions(): Promise<PermissionSummary[]> {
    const res = await this.db.app.query<PermissionSummary>(
      `SELECT code, module_code, description FROM permissions ORDER BY code`,
    );
    return res.rows;
  }
}
