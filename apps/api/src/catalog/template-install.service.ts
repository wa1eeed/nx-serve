import { Injectable } from '@nestjs/common';
import { uuidv7 } from '@nxserve/domain';
import { TemplatePayloadSchema } from '@nxserve/contracts';
import { applyTemplate } from '@nxserve/db';
import { DbService } from '../db/db.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { AppException } from '../common/app-exception.js';
import { type Actor } from '../context/request-context.js';

interface TemplateRow {
  id: string;
  version: number;
  payload: unknown;
}

@Injectable()
export class TemplateInstallService {
  constructor(
    private readonly db: DbService,
    private readonly outbox: OutboxService,
  ) {}

  /** Installs a published template into the tenant as an editable copy (docs/10). */
  async install(tenantId: string, templateCode: string, actor: Actor): Promise<{ vertical_id: string }> {
    return this.db.withTenant(tenantId, async (client) => {
      const t = await client.query<TemplateRow>(
        `SELECT id, version, payload FROM service_templates WHERE code = $1 AND is_published = true`,
        [templateCode],
      );
      const template = t.rows[0];
      if (!template) {
        throw new AppException('not_found', { detail: `No published template ${templateCode}` });
      }

      const already = await client.query(
        `SELECT 1 FROM tenant_template_installs WHERE tenant_id = $1 AND template_id = $2`,
        [tenantId, template.id],
      );
      if ((already.rowCount ?? 0) > 0) {
        throw new AppException('conflict', { detail: 'Template already installed' });
      }

      const payload = TemplatePayloadSchema.parse(template.payload);
      const result = await applyTemplate(client, tenantId, payload);

      await client.query(
        `INSERT INTO tenant_template_installs (id, tenant_id, template_id, version, vertical_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv7(), tenantId, template.id, template.version, result.verticalId],
      );
      await this.outbox.emit(client, {
        type: 'template.installed',
        tenantId,
        actor,
        data: { template_code: templateCode, vertical_id: result.verticalId },
      });

      return { vertical_id: result.verticalId };
    });
  }
}
