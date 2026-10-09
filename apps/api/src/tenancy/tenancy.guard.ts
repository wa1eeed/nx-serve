import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/app-exception.js';
import { NO_TENANT_KEY } from '../common/decorators.js';
import { DbService, type TenantRow } from '../db/db.service.js';
import { requireContext } from '../context/request-context.js';

type TenantRequest = {
  headers: Record<string, string | string[] | undefined>;
  tenant?: TenantRow;
};

/**
 * Resolves the tenant from the request host (or API credential, later phases)
 * and places its id on the request context so RLS scopes every query. Routes
 * marked @NoTenant (health, some auth steps) skip resolution.
 */
@Injectable()
export class TenancyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DbService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const noTenant = this.reflector.getAllAndOverride<boolean>(NO_TENANT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (noTenant === true) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<TenantRequest>();
    const host = String(req.headers['host'] ?? '');
    const tenant = await this.db.resolveTenantByHost(host);
    if (!tenant) {
      throw new AppException('tenant_not_resolved', { detail: `No tenant for host "${host}"` });
    }

    req.tenant = tenant;
    const context = requireContext();
    context.tenantId = tenant.id;
    return true;
  }
}
