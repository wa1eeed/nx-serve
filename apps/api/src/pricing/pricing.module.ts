import { Module } from '@nestjs/common';
import { EstimateController, PricingAdminController } from './pricing.controller.js';
import { PricingConfigController } from './pricing-admin.controller.js';
import { PricingService } from './pricing.service.js';
import { PricingAdminService } from './pricing-admin.service.js';

@Module({
  controllers: [EstimateController, PricingAdminController, PricingConfigController],
  providers: [PricingService, PricingAdminService],
})
export class PricingModule {}
