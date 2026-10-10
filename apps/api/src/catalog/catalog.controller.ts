import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { type FormSchema } from '@nxserve/domain';
import { AppException } from '../common/app-exception.js';
import { Ctx } from '../common/decorators.js';
import { type RequestContext } from '../context/request-context.js';
import { CatalogService, type VerticalSummary } from './catalog.service.js';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('verticals')
  verticals(@Ctx() ctx: RequestContext): Promise<VerticalSummary[]> {
    return this.catalog.listVerticals(tenantId(ctx));
  }

  /** The order form schema, localized and ETag versioned. */
  @Get('verticals/:id/form')
  async form(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<FormSchema | undefined> {
    const schema = await this.catalog.getVerticalForm(tenantId(ctx), id, ctx.locale);
    if (!schema) {
      throw new AppException('not_found', { detail: 'Vertical not found' });
    }
    const etag = `"${schema.version}"`;
    void reply.header('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      void reply.status(304);
      return undefined;
    }
    return schema;
  }
}

function tenantId(ctx: RequestContext): string {
  if (!ctx.tenantId) {
    throw new AppException('tenant_not_resolved');
  }
  return ctx.tenantId;
}
