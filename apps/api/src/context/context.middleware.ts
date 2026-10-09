import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { type RequestContext, runWithContext } from './request-context.js';

type Req = IncomingMessage & { id?: string };

/**
 * Establishes the request context (request id, locale, default actor) for the
 * lifetime of the request via AsyncLocalStorage. The tenancy guard fills in the
 * tenant id and the real actor afterwards on the same context object.
 */
@Injectable()
export class ContextMiddleware implements NestMiddleware {
  use(req: Req, res: ServerResponse, next: () => void): void {
    const requestId = typeof req.id === 'string' ? req.id : randomUUID();
    const acceptLanguage = String(req.headers['accept-language'] ?? '');
    const locale: 'ar' | 'en' = acceptLanguage.toLowerCase().startsWith('ar') ? 'ar' : 'en';

    const context: RequestContext = {
      requestId,
      locale,
      actor: { type: 'system' },
    };
    res.setHeader('X-Request-Id', requestId);
    runWithContext(context, () => next());
  }
}
