import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service.js';
import { PermissionsService } from './permissions.service.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { EntitlementGuard } from './entitlement.guard.js';
import { PermissionGuard } from './permission.guard.js';

@Global()
@Module({
  providers: [
    EntitlementsService,
    PermissionsService,
    AccessTokenGuard,
    EntitlementGuard,
    PermissionGuard,
  ],
  exports: [EntitlementsService, PermissionsService, AccessTokenGuard, EntitlementGuard, PermissionGuard],
})
export class AuthzModule {}
