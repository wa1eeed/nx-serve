import { Controller, Param, Post } from '@nestjs/common';
import { AppException } from '../common/app-exception.js';
import { Ctx, RequirePermission } from '../common/decorators.js';
import { type RequestContext } from '../context/request-context.js';
import { TemplateInstallService } from './template-install.service.js';

@Controller('admin/templates')
export class TemplateController {
  constructor(private readonly templates: TemplateInstallService) {}

  /** Installs a template into the tenant (requires catalog.manage). */
  @Post(':code/install')
  @RequirePermission('catalog.manage')
  install(@Param('code') code: string, @Ctx() ctx: RequestContext): Promise<{ vertical_id: string }> {
    if (!ctx.tenantId) {
      throw new AppException('tenant_not_resolved');
    }
    return this.templates.install(ctx.tenantId, code, ctx.actor);
  }
}
