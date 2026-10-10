import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type CategoryDetail,
  type CreateCategoryDto,
  CreateCategorySchema,
  type CreateFieldDto,
  CreateFieldSchema,
  type CreateVerticalDto,
  CreateVerticalSchema,
  type FieldDetail,
  type UpdateCategoryDto,
  UpdateCategorySchema,
  type UpdateFieldDto,
  UpdateFieldSchema,
  type UpdateVerticalDto,
  UpdateVerticalSchema,
  type VerticalDetail,
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

  @Post('verticals')
  createVertical(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateVerticalSchema)) body: CreateVerticalDto,
  ): Promise<{ id: string; code: string }> {
    return this.admin.createVertical(tenantId(ctx), body, ctx.actor);
  }

  @Get('verticals/:id')
  getVertical(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<VerticalDetail> {
    return this.admin.getVertical(tenantId(ctx), id);
  }

  @Delete('verticals/:id')
  @HttpCode(200)
  deleteVertical(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<{ status: 'ok' }> {
    return this.admin.deleteVertical(tenantId(ctx), id, ctx.actor);
  }

  @Patch('verticals/:id')
  updateVertical(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(UpdateVerticalSchema)) body: UpdateVerticalDto,
  ): Promise<{ id: string }> {
    return this.admin.updateVertical(tenantId(ctx), id, body, ctx.actor);
  }

  @Get('verticals/:verticalId/categories')
  listCategories(@Param('verticalId') verticalId: string, @Ctx() ctx: RequestContext): Promise<CategoryDetail[]> {
    return this.admin.listCategories(tenantId(ctx), verticalId);
  }

  @Post('verticals/:verticalId/categories')
  createCategory(
    @Param('verticalId') verticalId: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateCategorySchema)) body: CreateCategoryDto,
  ): Promise<{ id: string; code: string }> {
    return this.admin.createCategory(tenantId(ctx), verticalId, body, ctx.actor);
  }

  @Get('categories/:id')
  getCategory(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<CategoryDetail> {
    return this.admin.getCategory(tenantId(ctx), id);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) body: UpdateCategoryDto,
  ): Promise<{ id: string }> {
    return this.admin.updateCategory(tenantId(ctx), id, body, ctx.actor);
  }

  @Delete('categories/:id')
  @HttpCode(200)
  deleteCategory(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<{ status: 'ok' }> {
    return this.admin.deleteCategory(tenantId(ctx), id, ctx.actor);
  }

  @Get('verticals/:verticalId/fields')
  listFields(@Param('verticalId') verticalId: string, @Ctx() ctx: RequestContext): Promise<FieldDetail[]> {
    return this.admin.listFields(tenantId(ctx), verticalId);
  }

  @Post('verticals/:verticalId/fields')
  createField(
    @Param('verticalId') verticalId: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateFieldSchema)) body: CreateFieldDto,
  ): Promise<FieldResponse> {
    return this.admin.createField(tenantId(ctx), verticalId, body, ctx.actor);
  }

  @Get('fields/:id')
  getField(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<FieldDetail> {
    return this.admin.getField(tenantId(ctx), id);
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
