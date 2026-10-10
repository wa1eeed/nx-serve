import { Controller, Get } from '@nestjs/common';
import { AppException } from '../common/app-exception.js';
import { Ctx } from '../common/decorators.js';
import { type RequestContext } from '../context/request-context.js';
import { type PermissionSummary, RbacService, type RoleSummary } from './rbac.service.js';

@Controller()
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('roles')
  roles(@Ctx() ctx: RequestContext): Promise<RoleSummary[]> {
    if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
    return this.rbac.listRoles(ctx.tenantId);
  }

  @Get('permissions')
  permissions(): Promise<PermissionSummary[]> {
    return this.rbac.listPermissions();
  }
}
