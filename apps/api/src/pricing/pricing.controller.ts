import { Body, Controller, Post } from '@nestjs/common';
import {
  type EstimateRequestDto,
  EstimateRequestSchema,
  type SimulateRequestDto,
  SimulateRequestSchema,
} from '@nxserve/contracts';
import { AppException } from '../common/app-exception.js';
import { Ctx, RequirePermission } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { PricingService } from './pricing.service.js';

/** Customer-facing estimate (a quote), tenant-scoped, no permission required. */
@Controller('estimates')
export class EstimateController {
  constructor(private readonly pricing: PricingService) {}

  @Post()
  estimate(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(EstimateRequestSchema)) body: EstimateRequestDto) {
    return this.pricing.estimate(tenantId(ctx), new Date().toISOString(), body);
  }
}

/** The fee and price simulator (docs/09 section 8), for tenant staff. */
@Controller('admin/pricing')
@RequirePermission('pricing.edit')
export class PricingAdminController {
  constructor(private readonly pricing: PricingService) {}

  @Post('simulate')
  simulate(@Body(new ZodValidationPipe(SimulateRequestSchema)) body: SimulateRequestDto) {
    return this.pricing.simulate(body);
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
  return ctx.tenantId;
}
