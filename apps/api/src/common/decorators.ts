import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type RequestContext, requireContext } from '../context/request-context.js';

/** Marks a route as not requiring a resolved tenant (health, some auth routes). */
export const NO_TENANT_KEY = 'nx:noTenant';
export const NoTenant = (): MethodDecorator & ClassDecorator => SetMetadata(NO_TENANT_KEY, true);

/** Injects the current request context into a handler parameter. */
export const Ctx = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): RequestContext => requireContext(),
);

/** Injects the resolved tenant row (stashed by the tenancy guard). */
export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): unknown => {
  const req = ctx.switchToHttp().getRequest<{ tenant?: unknown }>();
  return req.tenant;
});
