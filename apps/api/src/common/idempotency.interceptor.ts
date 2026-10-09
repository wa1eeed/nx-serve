import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, lastValueFrom, of } from 'rxjs';
import { createHash } from 'node:crypto';
import { AppException } from './app-exception.js';
import { DbService } from '../db/db.service.js';
import { getContext } from '../context/request-context.js';

interface IdempotencyRow {
  request_hash: string;
  status_code: number | null;
  response: unknown;
}

/**
 * Enforces Idempotency-Key on tenant scoped POST requests and replays the stored
 * response for a repeated key (ADR-0008, docs/11). A reused key with a different
 * request body is a conflict. Keys are retained 24 h (cleaned by a worker job).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly db: DbService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest<{
      method: string;
      url: string;
      headers: Record<string, string | string[] | undefined>;
      body?: unknown;
    }>();
    const context = getContext();
    // Auth endpoints are not idempotency scoped (they mint their own tokens).
    if (req.method !== 'POST' || !context?.tenantId || req.url.includes('/auth/')) {
      return next.handle();
    }

    const rawKey = req.headers['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!key) {
      throw new AppException('idempotency_key_required', {
        detail: 'POST requests require an Idempotency-Key header',
      });
    }

    const tenantId = context.tenantId;
    const requestHash = createHash('sha256')
      .update(`${req.method}\n${req.url}\n${JSON.stringify(req.body ?? null)}`)
      .digest('hex');

    const existing = await this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<IdempotencyRow>(
        `SELECT request_hash, status_code, response FROM idempotency_keys WHERE key = $1`,
        [key],
      );
      return res.rows[0] ?? null;
    });

    if (existing) {
      if (existing.request_hash !== requestHash) {
        throw new AppException('idempotency_conflict');
      }
      if (existing.response !== null) {
        return of(existing.response);
      }
    }

    const result = (await lastValueFrom(next.handle())) as unknown;

    await this.db.withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO idempotency_keys (tenant_id, key, request_hash, method, path, status_code, response)
         VALUES ($1, $2, $3, $4, $5, 200, $6::jsonb)
         ON CONFLICT (tenant_id, key) DO UPDATE SET status_code = 200, response = EXCLUDED.response`,
        [tenantId, key, requestHash, req.method, req.url, JSON.stringify(result ?? null)],
      );
    });

    return of(result);
  }
}
