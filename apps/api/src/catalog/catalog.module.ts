import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { TemplateController } from './template.controller.js';
import { TemplateInstallService } from './template-install.service.js';

@Module({
  controllers: [CatalogController, TemplateController],
  providers: [CatalogService, TemplateInstallService],
})
export class CatalogModule {}
