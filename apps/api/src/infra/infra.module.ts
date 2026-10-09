import { Global, Module } from '@nestjs/common';
import { OutboxService } from '../outbox/outbox.service.js';
import { AuditService } from '../audit/audit.service.js';

/** Cross cutting services available everywhere: the outbox writer and audit log. */
@Global()
@Module({
  providers: [OutboxService, AuditService],
  exports: [OutboxService, AuditService],
})
export class InfraModule {}
