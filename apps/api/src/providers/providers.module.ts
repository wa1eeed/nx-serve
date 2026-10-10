import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProvidersController } from './providers.controller.js';
import { ProvidersService } from './providers.service.js';
import { ProvidersAdminController } from './providers-admin.controller.js';
import { ProvidersAdminService } from './providers-admin.service.js';
import { MerchantWebhookController } from './merchant-webhook.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [ProvidersController, ProvidersAdminController, MerchantWebhookController],
  providers: [ProvidersService, ProvidersAdminService],
})
export class ProvidersModule {}
