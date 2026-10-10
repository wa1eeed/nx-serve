import { Module } from '@nestjs/common';
import { EstimateController, PricingAdminController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';

@Module({
  controllers: [EstimateController, PricingAdminController],
  providers: [PricingService],
})
export class PricingModule {}
