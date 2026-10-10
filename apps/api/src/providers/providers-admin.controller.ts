import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  type AddGroupMemberDto,
  AddGroupMemberSchema,
  type CreateProviderGroupDto,
  CreateProviderGroupSchema,
  type ReviewDocumentDto,
  ReviewDocumentSchema,
  type ReviewOfferingDto,
  ReviewOfferingSchema,
} from '@nxserve/contracts';
import { AppException } from '../common/app-exception.js';
import { Ctx, RequirePermission } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { ProvidersAdminService } from './providers-admin.service.js';

@Controller('admin')
@RequirePermission('providers.approve')
export class ProvidersAdminController {
  constructor(private readonly admin: ProvidersAdminService) {}

  @Get('providers')
  listOrgs(@Ctx() ctx: RequestContext) {
    return this.admin.listOrgs(tenantId(ctx));
  }

  @Get('providers/:id')
  getOrg(@Param('id') id: string, @Ctx() ctx: RequestContext) {
    return this.admin.getOrg(tenantId(ctx), id);
  }

  @Get('providers/:id/offerings')
  listOfferings(@Param('id') id: string, @Ctx() ctx: RequestContext) {
    return this.admin.listOfferings(tenantId(ctx), id);
  }

  @Get('providers/:id/documents')
  listDocuments(@Param('id') id: string, @Ctx() ctx: RequestContext) {
    return this.admin.listDocuments(tenantId(ctx), id);
  }

  @Post('offerings/:id/review')
  reviewOffering(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(ReviewOfferingSchema)) body: ReviewOfferingDto,
  ) {
    return this.admin.reviewOffering(tenantId(ctx), id, body, ctx.actor);
  }

  @Post('documents/:id/review')
  reviewDocument(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(ReviewDocumentSchema)) body: ReviewDocumentDto,
  ) {
    return this.admin.reviewDocument(tenantId(ctx), id, body, ctx.actor);
  }

  @Post('providers/:id/merchant/refresh')
  refreshMerchant(@Param('id') id: string, @Ctx() ctx: RequestContext) {
    return this.admin.refreshMerchant(tenantId(ctx), id, ctx.actor);
  }

  @Post('provider-groups')
  createGroup(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateProviderGroupSchema)) body: CreateProviderGroupDto,
  ) {
    return this.admin.createGroup(tenantId(ctx), body, ctx.actor);
  }

  @Get('provider-groups')
  listGroups(@Ctx() ctx: RequestContext) {
    return this.admin.listGroups(tenantId(ctx));
  }

  @Post('provider-groups/:id/members')
  addGroupMember(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(AddGroupMemberSchema)) body: AddGroupMemberDto,
  ) {
    return this.admin.addGroupMember(tenantId(ctx), id, body, ctx.actor);
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
  return ctx.tenantId;
}
