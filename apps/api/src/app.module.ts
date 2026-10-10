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
import { AuthzModule } from './authz/authz.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { GeoModule } from './geo/geo.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { RbacModule } from './rbac/rbac.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ContextMiddleware } from './context/context.middleware.js';
import { ProblemExceptionFilter } from './common/problem.filter.js';
import { TenancyGuard } from './tenancy/tenancy.guard.js';
import { AccessTokenGuard } from './authz/access-token.guard.js';
import { EntitlementGuard } from './authz/entitlement.guard.js';
import { PermissionGuard } from './authz/permission.guard.js';
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
    AuthzModule,
    CatalogModule,
    GeoModule,
    VehiclesModule,
    SettingsModule,
    RbacModule,
    ProvidersModule,
    PricingModule,
    OrdersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemExceptionFilter },
    // Guards run in order: resolve tenant, set actor, then entitlement and permission checks.
    { provide: APP_GUARD, useClass: TenancyGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: EntitlementGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
