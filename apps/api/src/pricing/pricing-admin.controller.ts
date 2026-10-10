import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateFeeScheduleDto,
  CreateFeeScheduleSchema,
  type CreateRateCardDto,
  CreateRateCardSchema,
  type CreateSurgeScheduleDto,
  CreateSurgeScheduleSchema,
  type FeeScheduleDetail,
  type FeeScheduleSummary,
  type PricingApprovalDto,
  PricingApprovalSchema,
  type RateCardDetail,
  type RateCardSummary,
  type SurgeScheduleDetail,
  type UpdateFeeScheduleDto,
  UpdateFeeScheduleSchema,
  type UpdateRateCardDto,
  UpdateRateCardSchema,
  type UpdateSurgeScheduleDto,
  UpdateSurgeScheduleSchema,
} from '@nxserve/contracts';
import { AppException } from '../common/app-exception.js';
import { Ctx, RequirePermission } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { PricingAdminService } from './pricing-admin.service.js';

// Approve and reject carry optional notes; an empty POST body becomes {}.
const Approval = new ZodValidationPipe(PricingApprovalSchema.default({}));

/**
 * Pricing configuration for tenant staff (docs/09): rate cards and fee schedules
 * with maker-checker, and surge schedules. Editing is gated by pricing.edit;
 * approve, reject and archive are gated by pricing.approve (the approver can
 * never be the creator).
 */
@Controller('admin/pricing')
@RequirePermission('pricing.edit')
export class PricingConfigController {
  constructor(private readonly admin: PricingAdminService) {}

  // --- Rate cards ---

  @Post('rate-cards')
  createRateCard(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateRateCardSchema)) body: CreateRateCardDto,
  ): Promise<RateCardDetail> {
    return this.admin.createRateCard(tenantId(ctx), body, ctx.actor);
  }

  @Get('rate-cards')
  listRateCards(@Ctx() ctx: RequestContext): Promise<RateCardSummary[]> {
    return this.admin.listRateCards(tenantId(ctx));
  }

  @Get('rate-cards/:id')
  getRateCard(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<RateCardDetail> {
    return this.admin.getRateCard(tenantId(ctx), id);
  }

  @Patch('rate-cards/:id')
  updateRateCard(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(UpdateRateCardSchema)) body: UpdateRateCardDto,
  ): Promise<RateCardDetail> {
    return this.admin.updateRateCard(tenantId(ctx), id, body, ctx.actor);
  }

  @Post('rate-cards/:id/submit')
  @HttpCode(200)
  submitRateCard(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<RateCardDetail> {
    return this.admin.submitRateCard(tenantId(ctx), id, ctx.actor);
  }

  @Post('rate-cards/:id/approve')
  @HttpCode(200)
  @RequirePermission('pricing.approve')
  approveRateCard(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(Approval) body: PricingApprovalDto,
  ): Promise<RateCardDetail> {
    return this.admin.approveRateCard(tenantId(ctx), id, body, ctx.actor);
  }

  @Post('rate-cards/:id/reject')
  @HttpCode(200)
  @RequirePermission('pricing.approve')
  rejectRateCard(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(Approval) body: PricingApprovalDto,
  ): Promise<RateCardDetail> {
    return this.admin.rejectRateCard(tenantId(ctx), id, body, ctx.actor);
  }

  @Post('rate-cards/:id/archive')
  @HttpCode(200)
  @RequirePermission('pricing.approve')
  archiveRateCard(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<RateCardDetail> {
    return this.admin.archiveRateCard(tenantId(ctx), id, ctx.actor);
  }

  // --- Fee schedules ---

  @Post('fee-schedules')
  createFeeSchedule(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateFeeScheduleSchema)) body: CreateFeeScheduleDto,
  ): Promise<FeeScheduleDetail> {
    return this.admin.createFeeSchedule(tenantId(ctx), body, ctx.actor);
  }

  @Get('fee-schedules')
  listFeeSchedules(@Ctx() ctx: RequestContext): Promise<FeeScheduleSummary[]> {
    return this.admin.listFeeSchedules(tenantId(ctx));
  }

  @Get('fee-schedules/:id')
  getFeeSchedule(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<FeeScheduleDetail> {
    return this.admin.getFeeSchedule(tenantId(ctx), id);
  }

  @Patch('fee-schedules/:id')
  updateFeeSchedule(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(UpdateFeeScheduleSchema)) body: UpdateFeeScheduleDto,
  ): Promise<FeeScheduleDetail> {
    return this.admin.updateFeeSchedule(tenantId(ctx), id, body, ctx.actor);
  }

  @Post('fee-schedules/:id/submit')
  @HttpCode(200)
  submitFeeSchedule(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<FeeScheduleDetail> {
    return this.admin.submitFeeSchedule(tenantId(ctx), id, ctx.actor);
  }

  @Post('fee-schedules/:id/approve')
  @HttpCode(200)
  @RequirePermission('pricing.approve')
  approveFeeSchedule(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(Approval) body: PricingApprovalDto,
  ): Promise<FeeScheduleDetail> {
    return this.admin.approveFeeSchedule(tenantId(ctx), id, body, ctx.actor);
  }

  @Post('fee-schedules/:id/reject')
  @HttpCode(200)
  @RequirePermission('pricing.approve')
  rejectFeeSchedule(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(Approval) body: PricingApprovalDto,
  ): Promise<FeeScheduleDetail> {
    return this.admin.rejectFeeSchedule(tenantId(ctx), id, body, ctx.actor);
  }

  @Post('fee-schedules/:id/archive')
  @HttpCode(200)
  @RequirePermission('pricing.approve')
  archiveFeeSchedule(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<FeeScheduleDetail> {
    return this.admin.archiveFeeSchedule(tenantId(ctx), id, ctx.actor);
  }

  // --- Surge schedules (configuration) ---

  @Post('surge-schedules')
  createSurgeSchedule(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateSurgeScheduleSchema)) body: CreateSurgeScheduleDto,
  ): Promise<SurgeScheduleDetail> {
    return this.admin.createSurgeSchedule(tenantId(ctx), body, ctx.actor);
  }

  @Get('surge-schedules')
  listSurgeSchedules(@Ctx() ctx: RequestContext): Promise<SurgeScheduleDetail[]> {
    return this.admin.listSurgeSchedules(tenantId(ctx));
  }

  @Patch('surge-schedules/:id')
  updateSurgeSchedule(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(UpdateSurgeScheduleSchema)) body: UpdateSurgeScheduleDto,
  ): Promise<SurgeScheduleDetail> {
    return this.admin.updateSurgeSchedule(tenantId(ctx), id, body, ctx.actor);
  }

  @Delete('surge-schedules/:id')
  @HttpCode(200)
  deleteSurgeSchedule(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<{ status: 'ok' }> {
    return this.admin.deleteSurgeSchedule(tenantId(ctx), id, ctx.actor);
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
  return ctx.tenantId;
}
