import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { type UpsertSettingDto, UpsertSettingSchema } from '@nxserve/contracts';
import { AppException } from '../common/app-exception.js';
import { Ctx, RequirePermission } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { SettingsService } from './settings.service.js';
import { EntitlementsService } from '../authz/entitlements.service.js';

@Controller()
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get('settings')
  effective(@Ctx() ctx: RequestContext): Promise<Record<string, unknown>> {
    return this.settings.getEffective(tenantId(ctx));
  }

  @Put('admin/settings/:key')
  @RequirePermission('settings.manage')
  upsert(
    @Param('key') key: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(UpsertSettingSchema)) body: UpsertSettingDto,
  ): Promise<{ key: string; value: unknown }> {
    return this.settings.upsertTenantValue(tenantId(ctx), key, body.value, ctx.actor);
  }

  @Get('entitlements')
  entitlementsEffective(
    @Ctx() ctx: RequestContext,
  ): Promise<{ modules: string[]; limits: Record<string, number | null> }> {
    return this.entitlements.getEffective(tenantId(ctx));
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
  return ctx.tenantId;
}
