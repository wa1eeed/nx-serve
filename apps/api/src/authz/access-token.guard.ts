import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { jwtVerify } from 'jose';
import { AppException } from '../common/app-exception.js';
import { ConfigService } from '../config/config.service.js';
import { type ActorType, requireContext } from '../context/request-context.js';

/**
 * If an Authorization: Bearer token is present, verifies it and sets the actor on
 * the request context (and checks it belongs to the resolved tenant). Absent
 * token means an anonymous request; route guards decide what anonymous may do.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  private readonly secret: Uint8Array;

  constructor(config: ConfigService) {
    this.secret = new TextEncoder().encode(config.jwtAccessSecret);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const header = req.headers['authorization'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw) return true;

    const match = /^Bearer (.+)$/.exec(raw);
    if (!match) {
      throw new AppException('unauthorized', { detail: 'Malformed Authorization header' });
    }

    let claims: { type: ActorType; id: string; tenantId: string | null };
    try {
      const { payload } = await jwtVerify(match[1] as string, this.secret);
      if (typeof payload.sub !== 'string' || typeof payload.typ !== 'string') {
        throw new AppException('unauthorized');
      }
      claims = {
        type: payload.typ as ActorType,
        id: payload.sub,
        tenantId: (payload.tid as string | null) ?? null,
      };
    } catch (err) {
      if (err instanceof AppException) throw err;
      throw new AppException('unauthorized', { detail: 'Invalid access token' });
    }

    const context = requireContext();
    if (claims.tenantId && context.tenantId && claims.tenantId !== context.tenantId) {
      throw new AppException('forbidden', { detail: 'Token does not belong to this tenant' });
    }
    context.actor = { type: claims.type, id: claims.id };
    return true;
  }
}
