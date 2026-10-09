import { Controller, Get } from '@nestjs/common';
import { AppException } from '../common/app-exception.js';
import { NoTenant } from '../common/decorators.js';
import { DbService } from '../db/db.service.js';
import { RedisService } from '../redis/redis.service.js';

@Controller()
@NoTenant()
export class HealthController {
  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: the process is up. GET /v1/health */
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: dependencies reachable. GET /v1/ready */
  @Get('ready')
  async ready(): Promise<{ status: 'ok'; checks: Record<string, 'ok'> }> {
    const checks: Record<string, 'ok'> = {};
    try {
      await this.db.ping();
      checks.database = 'ok';
      await this.redis.ping();
      checks.redis = 'ok';
    } catch (err) {
      throw new AppException('service_unavailable', {
        detail: err instanceof Error ? err.message : 'dependency unavailable',
      });
    }
    return { status: 'ok', checks };
  }
}
