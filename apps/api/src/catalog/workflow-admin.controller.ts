import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateStageDto,
  CreateStageSchema,
  type CreateWorkflowDto,
  CreateWorkflowSchema,
  type ReorderDto,
  ReorderSchema,
  type StageDetail,
  type UpdateStageDto,
  UpdateStageSchema,
  type UpdateWorkflowDto,
  UpdateWorkflowSchema,
  type WorkflowDetail,
} from '@nxserve/contracts';
import { AppException } from '../common/app-exception.js';
import { Ctx, RequirePermission } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { WorkflowAdminService } from './workflow-admin.service.js';

@Controller('admin')
@RequirePermission('catalog.manage')
export class WorkflowAdminController {
  constructor(private readonly workflows: WorkflowAdminService) {}

  @Get('verticals/:verticalId/workflow')
  getForVertical(@Param('verticalId') verticalId: string, @Ctx() ctx: RequestContext): Promise<WorkflowDetail> {
    return this.workflows.getForVertical(tenantId(ctx), verticalId);
  }

  @Post('verticals/:verticalId/workflow')
  createForVertical(
    @Param('verticalId') verticalId: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateWorkflowSchema)) body: CreateWorkflowDto,
  ): Promise<{ id: string }> {
    return this.workflows.createForVertical(tenantId(ctx), verticalId, body, ctx.actor);
  }

  @Patch('workflows/:id')
  updateWorkflow(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(UpdateWorkflowSchema)) body: UpdateWorkflowDto,
  ): Promise<{ id: string }> {
    return this.workflows.updateWorkflow(tenantId(ctx), id, body, ctx.actor);
  }

  @Post('workflows/:workflowId/stages')
  createStage(
    @Param('workflowId') workflowId: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(CreateStageSchema)) body: CreateStageDto,
  ): Promise<StageDetail> {
    return this.workflows.createStage(tenantId(ctx), workflowId, body, ctx.actor);
  }

  @Post('workflows/:workflowId/stages/reorder')
  @HttpCode(200)
  reorder(
    @Param('workflowId') workflowId: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(ReorderSchema)) body: ReorderDto,
  ): Promise<{ status: 'ok' }> {
    return this.workflows.reorderStages(tenantId(ctx), workflowId, body.order, ctx.actor);
  }

  @Patch('stages/:id')
  updateStage(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(UpdateStageSchema)) body: UpdateStageDto,
  ): Promise<StageDetail> {
    return this.workflows.updateStage(tenantId(ctx), id, body, ctx.actor);
  }

  @Delete('stages/:id')
  @HttpCode(200)
  deleteStage(@Param('id') id: string, @Ctx() ctx: RequestContext): Promise<{ status: 'ok' }> {
    return this.workflows.deleteStage(tenantId(ctx), id, ctx.actor);
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
  return ctx.tenantId;
}
