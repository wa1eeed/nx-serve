import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { RedisModule } from './redis/redis.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { InfraModule } from './infra/infra.module.js';
import { HealthModule } from './health/health.module.js';
import { BootstrapModule } from './bootstrap/bootstrap.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ContextMiddleware } from './context/context.middleware.js';
import { ProblemExceptionFilter } from './common/problem.filter.js';
import { TenancyGuard } from './tenancy/tenancy.guard.js';
import { IdempotencyInterceptor } from './common/idempotency.interceptor.js';
import { AuditInterceptor } from './audit/audit.interceptor.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    RedisModule,
    IntegrationsModule,
    InfraModule,
    HealthModule,
    BootstrapModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemExceptionFilter },
    { provide: APP_GUARD, useClass: TenancyGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
