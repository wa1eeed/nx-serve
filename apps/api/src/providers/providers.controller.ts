import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  type ApplyOfferingDto,
  ApplyOfferingSchema,
  type CreateAgentDto,
  CreateAgentSchema,
  type CreateAssetDto,
  CreateAssetSchema,
  type LinkAgentAssetDto,
  LinkAgentAssetSchema,
  type PresenceDto,
  PresenceSchema,
  type RegisterProviderRequestDto,
  RegisterProviderRequestSchema,
  type UploadDocumentDto,
  UploadDocumentSchema,
} from '@nxserve/contracts';
import { AppException } from '../common/app-exception.js';
import { Ctx } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { ProvidersService } from './providers.service.js';

/** Provider self service. Registration is OTP verified; the rest act as the owner agent. */
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Post('register')
  register(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(RegisterProviderRequestSchema)) body: RegisterProviderRequestDto,
  ) {
    return this.providers.register(tenantId(ctx), body, { challengeId: body.challenge_id, code: body.code });
  }

  @Get('me')
  me(@Ctx() ctx: RequestContext) {
    return this.providers.getMe(tenantId(ctx), agentId(ctx));
  }

  @Post('me/agents')
  addAgent(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(CreateAgentSchema)) body: CreateAgentDto) {
    return this.providers.addAgent(tenantId(ctx), agentId(ctx), body);
  }

  @Post('me/assets')
  addAsset(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(CreateAssetSchema)) body: CreateAssetDto) {
    return this.providers.addAsset(tenantId(ctx), agentId(ctx), body);
  }

  @Post('me/agent-assets')
  linkAgentAsset(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(LinkAgentAssetSchema)) body: LinkAgentAssetDto) {
    return this.providers.linkAgentAsset(tenantId(ctx), agentId(ctx), body);
  }

  @Post('me/offerings')
  applyOffering(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(ApplyOfferingSchema)) body: ApplyOfferingDto) {
    return this.providers.applyOffering(tenantId(ctx), agentId(ctx), body);
  }

  @Get('me/offerings')
  listOfferings(@Ctx() ctx: RequestContext) {
    return this.providers.listOfferings(tenantId(ctx), agentId(ctx));
  }

  @Post('me/documents')
  uploadDocument(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(UploadDocumentSchema)) body: UploadDocumentDto) {
    return this.providers.uploadDocument(tenantId(ctx), agentId(ctx), body);
  }

  @Get('me/documents')
  listDocuments(@Ctx() ctx: RequestContext) {
    return this.providers.listDocuments(tenantId(ctx), agentId(ctx));
  }

  @Put('me/presence')
  presence(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(PresenceSchema)) body: PresenceDto) {
    return this.providers.updatePresence(tenantId(ctx), agentId(ctx), body);
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
  return ctx.tenantId;
}

function agentId(ctx: RequestContext): string {
  if (ctx.actor.type !== 'agent' || !ctx.actor.id) {
    throw new AppException('unauthorized', { detail: 'Provider agent authentication required' });
  }
  return ctx.actor.id;
}
