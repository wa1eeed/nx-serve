import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/app-exception.js';
import { REQUIRE_PERMISSION_KEY } from '../common/decorators.js';
import { requireContext } from '../context/request-context.js';
import { PermissionsService } from './permissions.service.js';

/** Enforces `@RequirePermission`: the staff actor must hold the permission. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;

    const context = requireContext();
    if (context.actor.type !== 'staff' || !context.actor.id || !context.tenantId) {
      throw new AppException('permission_denied', { detail: 'Staff authentication required' });
    }
    const perms = await this.permissions.getPermissions(context.tenantId, context.actor.id);
    context.permissions = [...perms];
    if (!perms.has(required)) {
      throw new AppException('permission_denied', { detail: `Missing permission ${required}` });
    }
    return true;
  }
}
