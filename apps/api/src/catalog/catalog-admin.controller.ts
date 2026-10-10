import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateFieldDto,
  CreateFieldSchema,
  type UpdateFieldDto,
  UpdateFieldSchema,
} from '@nxserve/contracts';
import { AppException } from '../common/app-exception.js';
import { Ctx, RequirePermission } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { CatalogAdminService, type FieldResponse } from './catalog-admin.service.js';

@Controller('admin')
@RequirePermission('catalog.manage')
export class CatalogAdminController {
  constructor(private readonly admin: CatalogAdminService) {}

  @Post('verticals/:verticalId/fields')
  createField(
    @Param('verticalId') verticalId: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateFieldSchema)) body: CreateFieldDto,
  ): Promise<FieldResponse> {
    return this.admin.createField(tenantId(ctx), verticalId, body, ctx.actor);
  }

  @Patch('fields/:id')
  updateField(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(UpdateFieldSchema)) body: UpdateFieldDto,
  ): Promise<FieldResponse> {
    return this.admin.updateField(tenantId(ctx), id, body, ctx.actor);
  }

  @Delete('fields/:id')
  @HttpCode(200)
  deleteField(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<{ status: 'ok' }> {
    return this.admin.deleteField(tenantId(ctx), id, ctx.actor);
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) {
    throw new AppException('tenant_not_resolved');
  }
  return ctx.tenantId;
}
