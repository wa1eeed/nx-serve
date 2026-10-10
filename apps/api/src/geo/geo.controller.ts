import { Controller, Get } from '@nestjs/common';
import { AppException } from '../common/app-exception.js';
import { Ctx } from '../common/decorators.js';
import { type RequestContext } from '../context/request-context.js';
import { type AvailabilityRow, type CitySummary, GeoService, type ZoneSummary } from './geo.service.js';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('cities')
  cities(): Promise<CitySummary[]> {
    return this.geo.listCities();
  }

  @Get('zones')
  zones(@Ctx() ctx: RequestContext): Promise<ZoneSummary[]> {
    return this.geo.listZones(tenantId(ctx));
  }

  @Get('availability')
  availability(@Ctx() ctx: RequestContext): Promise<AvailabilityRow[]> {
    return this.geo.listAvailability(tenantId(ctx));
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
  return ctx.tenantId;
}
