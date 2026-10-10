import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/app-exception.js';
import { REQUIRE_MODULE_KEY } from '../common/decorators.js';
import { requireContext } from '../context/request-context.js';
import { EntitlementsService } from './entitlements.service.js';

/** Enforces `@RequireModule`: a route is reachable only if the tenant has it. */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string>(REQUIRE_MODULE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;

    const context = requireContext();
    if (!context.tenantId) {
      throw new AppException('tenant_not_resolved');
    }
    const modules = await this.entitlements.getEffectiveModules(context.tenantId);
    context.entitlements = [...modules];
    if (!modules.has(required)) {
      throw new AppException('entitlement_required', {
        detail: `This feature requires the ${required} module`,
        requiredModule: required,
      });
    }
    return true;
  }
}
