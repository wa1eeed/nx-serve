import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  type AdvanceStageDto,
  AdvanceStageSchema,
  type CreateOrderDto,
  CreateOrderSchema,
  type OrderDetail,
  type StageResult,
} from '@nxserve/contracts';
import { AppException } from '../common/app-exception.js';
import { Ctx } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { OrdersService } from './orders.service.js';

/** Customer-facing orders (docs/07), tenant-scoped. A customer creates and reads
 * their own orders; the workflow and payments run in later increments. */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateOrderSchema)) body: CreateOrderDto,
  ): Promise<OrderDetail> {
    return this.orders.createOrder(tenantId(ctx), ctx.actor, body);
  }

  @Get(':id')
  get(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<OrderDetail> {
    return this.orders.getOrder(tenantId(ctx), id, ctx.actor);
  }

  @Post(':id/advance')
  @HttpCode(200)
  advance(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(AdvanceStageSchema)) body: AdvanceStageDto,
  ): Promise<StageResult> {
    return this.orders.advanceStage(tenantId(ctx), id, body, ctx.actor);
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
  return ctx.tenantId;
}
