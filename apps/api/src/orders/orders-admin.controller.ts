import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  type AssignOrderDto,
  AssignOrderSchema,
  type ForceTransitionDto,
  ForceTransitionSchema,
  type OrderDetail,
  type StageResult,
} from '@nxserve/contracts';
import { AppException } from '../common/app-exception.js';
import { Ctx, RequirePermission } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { OrdersService } from './orders.service.js';

/** Ops and staff order operations (docs/07, docs/08): read any order, and manually
 * assign a provider (manual dispatch), which starts the workflow. */
@Controller('admin/orders')
export class OrdersAdminController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  @RequirePermission('orders.view')
  get(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<OrderDetail> {
    return this.orders.getOrderForStaff(tenantId(ctx), id);
  }

  @Post(':id/assign')
  @HttpCode(200)
  @RequirePermission('orders.dispatch')
  assign(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(AssignOrderSchema)) body: AssignOrderDto,
  ): Promise<StageResult> {
    return this.orders.assignOrder(tenantId(ctx), id, body, ctx.actor);
  }

  @Post(':id/force')
  @HttpCode(200)
  @RequirePermission('orders.dispatch')
  force(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(ForceTransitionSchema)) body: ForceTransitionDto,
  ): Promise<StageResult> {
    return this.orders.forceTransition(tenantId(ctx), id, body, ctx.actor);
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
  return ctx.tenantId;
}
