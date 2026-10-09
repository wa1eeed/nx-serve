import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';
import { AuditService } from './audit.service.js';
import { getContext } from '../context/request-context.js';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Coarse audit of staff mutations. Services add richer before/after entries. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{
      method: string;
      url: string;
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const context = getContext();

    return next.handle().pipe(
      tap(() => {
        if (MUTATING.has(req.method) && context?.actor.type === 'staff') {
          const userAgent = req.headers['user-agent'];
          void this.audit.record({
            ...(context.tenantId !== undefined ? { tenantId: context.tenantId } : {}),
            actor: context.actor,
            action: `${req.method} ${req.url}`,
            entity: 'http_request',
            ...(req.ip !== undefined ? { ip: req.ip } : {}),
            ...(typeof userAgent === 'string' ? { userAgent } : {}),
          });
        }
      }),
    );
  }
}
