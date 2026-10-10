import { Controller, Get, Query } from '@nestjs/common';
import { AppException } from '../common/app-exception.js';
import { Ctx } from '../common/decorators.js';
import { type RequestContext } from '../context/request-context.js';
import {
  type VehicleClassSummary,
  type VehicleMakeSummary,
  type VehicleModelSummary,
  VehiclesService,
} from './vehicles.service.js';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get('makes')
  makes(): Promise<VehicleMakeSummary[]> {
    return this.vehicles.listMakes();
  }

  @Get('models')
  models(@Query('make_id') makeId?: string): Promise<VehicleModelSummary[]> {
    return this.vehicles.listModels(makeId);
  }

  @Get('classes')
  classes(@Ctx() ctx: RequestContext): Promise<VehicleClassSummary[]> {
    if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
    return this.vehicles.listClasses(ctx.tenantId);
  }
}
