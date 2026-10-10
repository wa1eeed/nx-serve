import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { type FastifyRequest } from 'fastify';
import { type MerchantWebhookDto, MerchantWebhookSchema } from '@nxserve/contracts';
import { AppException } from '../common/app-exception.js';
import { Ctx } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { ProvidersAdminService } from './providers-admin.service.js';

/**
 * Gateway merchant status webhook. Not permission guarded (the caller is the
 * gateway, not a user): authenticated by the shared secret and optional IP
 * allowlist, tenant resolved from the host, and processed exactly once.
 */
@Controller('webhooks')
export class MerchantWebhookController {
  constructor(private readonly admin: ProvidersAdminService) {}

  @Post('merchant')
  @HttpCode(200)
  merchant(
    @Ctx() ctx: RequestContext,
    @Req() req: FastifyRequest,
    @Body(new ZodValidationPipe(MerchantWebhookSchema)) body: MerchantWebhookDto,
  ): Promise<{ status: 'ok' }> {
    if (!ctx.tenantId) throw new AppException('tenant_not_resolved');
    const received = String(req.headers['x-webhook-secret'] ?? '');
    return this.admin.processMerchantWebhook(ctx.tenantId, body, { receivedSecret: received, sourceIp: req.ip });
  }
}
