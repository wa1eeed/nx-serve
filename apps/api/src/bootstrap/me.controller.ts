import { Controller, Get } from '@nestjs/common';
import { Ctx } from '../common/decorators.js';
import { type RequestContext } from '../context/request-context.js';

@Controller()
export class MeController {
  /** Echoes the resolved request context (actor, tenant, locale). */
  @Get('me')
  me(@Ctx() ctx: RequestContext): Record<string, unknown> {
    return {
      request_id: ctx.requestId,
      locale: ctx.locale,
      actor: ctx.actor,
      tenant_id: ctx.tenantId ?? null,
    };
  }
}
