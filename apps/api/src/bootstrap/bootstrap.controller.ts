import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '../config/config.service.js';
import { CurrentTenant, Ctx } from '../common/decorators.js';
import { type TenantRow } from '../db/db.service.js';
import { type RequestContext } from '../context/request-context.js';

@Controller('app')
export class BootstrapController {
  constructor(private readonly config: ConfigService) {}

  /** Client bootstrap: tenant theme, locales and flags, resolved by host. */
  @Get('bootstrap')
  bootstrap(@CurrentTenant() tenant: TenantRow, @Ctx() ctx: RequestContext): Record<string, unknown> {
    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        display_name: tenant.displayName,
        branding: tenant.branding,
      },
      locale: ctx.locale,
      default_locale: tenant.defaultLocale,
      supported_locales: tenant.supportedLocales,
      payments_enabled: this.config.paymentsEnabled,
      feature_flags: {},
    };
  }
}
