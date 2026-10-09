import { Global, Module } from '@nestjs/common';
import { type Integrations, createIntegrations } from '@nxserve/integrations';

/** DI token for the external adapter set (all fakes in Phase 0). */
export const INTEGRATIONS = Symbol('INTEGRATIONS');

@Global()
@Module({
  providers: [{ provide: INTEGRATIONS, useFactory: (): Integrations => createIntegrations() }],
  exports: [INTEGRATIONS],
})
export class IntegrationsModule {}
