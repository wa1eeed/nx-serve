import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { CatalogAdminController } from './catalog-admin.controller.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { TemplateController } from './template.controller.js';
import { TemplateInstallService } from './template-install.service.js';
import { WorkflowAdminController } from './workflow-admin.controller.js';
import { WorkflowAdminService } from './workflow-admin.service.js';

@Module({
  controllers: [CatalogController, CatalogAdminController, TemplateController, WorkflowAdminController],
  providers: [CatalogService, CatalogAdminService, TemplateInstallService, WorkflowAdminService],
})
export class CatalogModule {}
