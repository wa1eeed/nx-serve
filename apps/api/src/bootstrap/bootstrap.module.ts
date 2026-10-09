import { Module } from '@nestjs/common';
import { BootstrapController } from './bootstrap.controller.js';
import { MeController } from './me.controller.js';

@Module({
  controllers: [BootstrapController, MeController],
})
export class BootstrapModule {}
