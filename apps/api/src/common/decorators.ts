import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type RequestContext, requireContext } from '../context/request-context.js';

/** Marks a route as not requiring a resolved tenant (health, some auth routes). */
export const NO_TENANT_KEY = 'nx:noTenant';
export const NoTenant = (): MethodDecorator & ClassDecorator => SetMetadata(NO_TENANT_KEY, true);

/** Requires the tenant to be entitled to a module (else 403 entitlement_required). */
export const REQUIRE_MODULE_KEY = 'nx:requireModule';
export const RequireModule = (moduleCode: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_MODULE_KEY, moduleCode);

/** Requires the staff actor to hold a permission (else 403 permission_denied). */
export const REQUIRE_PERMISSION_KEY = 'nx:requirePermission';
export const RequirePermission = (permission: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);

/** Injects the current request context into a handler parameter. */
export const Ctx = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): RequestContext => requireContext(),
);

/** Injects the resolved tenant row (stashed by the tenancy guard). */
export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): unknown => {
  const req = ctx.switchToHttp().getRequest<{ tenant?: unknown }>();
  return req.tenant;
});
