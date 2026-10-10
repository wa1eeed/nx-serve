import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersAdminController } from './orders-admin.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrdersController, OrdersAdminController],
  providers: [OrdersService],
})
export class OrdersModule {}
