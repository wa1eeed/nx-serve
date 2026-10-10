import { Inject, Injectable } from '@nestjs/common';
import { type PoolClient } from '@nxserve/db';
import { uuidv7 } from '@nxserve/domain';
import {
  type AddGroupMemberDto,
  type CreateProviderGroupDto,
  type DocumentDetail,
  type MerchantWebhookDto,
  type OfferingDetail,
  type OnboardingStatus,
  type ProviderGroupDetail,
  type ProviderOrgDetail,
  type ReviewDocumentDto,
  type ReviewOfferingDto,
  type TranslatableText,
} from '@nxserve/contracts';
import { type Integrations } from '@nxserve/integrations';
import { DbService } from '../db/db.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { ConfigService } from '../config/config.service.js';
import { AppException } from '../common/app-exception.js';
import { type Actor } from '../context/request-context.js';
import { INTEGRATIONS } from '../integrations/integrations.module.js';
import {
  DOCUMENT_SELECT,
  type DocumentRow,
  OFFERING_SELECT,
  ORG_SELECT,
  type OfferingRow,
  type OrgRow,
  toDocumentDetail,
  toOfferingDetail,
  toOrgDetail,
} from './providers.service.js';
import { ProvidersService } from './providers.service.js';

const j = (value: unknown): string => JSON.stringify(value);

const OFFERING_DECISION: Record<ReviewOfferingDto['decision'], string> = {
  approve: 'approved',
  needs_info: 'needs_info',
  reject: 'rejected',
};

/** Tenant admin review of providers (docs/08), guarded by providers.approve. */
@Injectable()
export class ProvidersAdminService {
  constructor(
    private readonly db: DbService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
    private readonly providers: ProvidersService,
    @Inject(INTEGRATIONS) private readonly integrations: Integrations,
  ) {}

  listOrgs(tenantId: string): Promise<ProviderOrgDetail[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<OrgRow>(`${ORG_SELECT} ORDER BY created_at DESC`);
      return res.rows.map(toOrgDetail);
    });
  }

  getOrg(tenantId: string, orgId: string): Promise<{ org: ProviderOrgDetail; onboarding: OnboardingStatus }> {
    return this.providers.onboardingForOrg(tenantId, orgId);
  }

  listOfferings(tenantId: string, orgId: string): Promise<OfferingDetail[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<OfferingRow>(`${OFFERING_SELECT} WHERE org_id = $1 ORDER BY id`, [orgId]);
      return res.rows.map(toOfferingDetail);
    });
  }

  listDocuments(tenantId: string, orgId: string): Promise<DocumentDetail[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<DocumentRow>(`${DOCUMENT_SELECT} WHERE org_id = $1 ORDER BY uploaded_at`, [orgId]);
      return res.rows.map(toDocumentDetail);
    });
  }

  reviewOffering(tenantId: string, offeringId: string, dto: ReviewOfferingDto, actor: Actor): Promise<OfferingDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const status = OFFERING_DECISION[dto.decision];
      const res = await client.query<{ org_id: string }>(
        `UPDATE provider_offerings
           SET status = $2, reviewed_by = $3, reviewed_at = now(), review_notes = $4
         WHERE id = $1 RETURNING org_id`,
        [offeringId, status, actor.id ?? null, dto.notes ?? null],
      );
      const row = res.rows[0];
      if (!row) throw new AppException('not_found', { detail: 'Offering not found' });
      await this.outbox.emit(client, {
        type: 'offering.reviewed',
        tenantId,
        actor,
        data: { provider_org_id: row.org_id, offering_id: offeringId, status },
      });
      const out = await client.query<OfferingRow>(`${OFFERING_SELECT} WHERE id = $1`, [offeringId]);
      const detail = out.rows[0];
      if (!detail) throw new AppException('not_found', { detail: 'Offering not found' });
      return toOfferingDetail(detail);
    });
  }

  reviewDocument(tenantId: string, documentId: string, dto: ReviewDocumentDto, actor: Actor): Promise<DocumentDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const status = dto.decision === 'verify' ? 'verified' : 'rejected';
      const res = await client.query<{ org_id: string }>(
        `UPDATE provider_documents SET verify_status = $2 WHERE id = $1 RETURNING org_id`,
        [documentId, status],
      );
      const row = res.rows[0];
      if (!row) throw new AppException('not_found', { detail: 'Document not found' });
      await this.outbox.emit(client, {
        type: 'document.reviewed',
        tenantId,
        actor,
        data: { provider_org_id: row.org_id, document_id: documentId, status },
      });
      const out = await client.query<DocumentRow>(`${DOCUMENT_SELECT} WHERE id = $1`, [documentId]);
      const detail = out.rows[0];
      if (!detail) throw new AppException('not_found', { detail: 'Document not found' });
      return toDocumentDetail(detail);
    });
  }

  /** Pulls the latest merchant status from the gateway and stores it. */
  async refreshMerchant(tenantId: string, orgId: string, actor: Actor): Promise<ProviderOrgDetail> {
    const merchantId = await this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{ moyasar_merchant_id: string | null }>(
        `SELECT moyasar_merchant_id FROM provider_orgs WHERE id = $1`,
        [orgId],
      );
      const row = res.rows[0];
      if (!row) throw new AppException('not_found', { detail: 'Provider not found' });
      return row.moyasar_merchant_id;
    });
    if (!merchantId) throw new AppException('conflict', { detail: 'Provider has no merchant yet' });

    const merchant = await this.integrations.payments.getMerchant(merchantId); // outside any transaction

    return this.db.withTenant(tenantId, async (client) => {
      await client.query(`UPDATE provider_orgs SET moyasar_status = $2 WHERE id = $1`, [orgId, merchant.status]);
      await this.outbox.emit(client, {
        type: 'merchant.status_changed',
        tenantId,
        actor,
        data: { provider_org_id: orgId, merchant_id: merchantId, status: merchant.status },
      });
      const out = await client.query<OrgRow>(`${ORG_SELECT} WHERE id = $1`, [orgId]);
      const row = out.rows[0];
      if (!row) throw new AppException('not_found', { detail: 'Provider not found' });
      return toOrgDetail(row);
    });
  }

  // --- Provider groups ---

  createGroup(tenantId: string, dto: CreateProviderGroupDto, actor: Actor): Promise<ProviderGroupDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const id = uuidv7();
      await client.query(
        `INSERT INTO provider_groups (id, tenant_id, vertical_id, name, description)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)`,
        [id, tenantId, dto.vertical_id ?? null, j(dto.name), dto.description ? j(dto.description) : null],
      );
      await this.outbox.emit(client, { type: 'group.changed', tenantId, actor, data: { group_id: id, action: 'created' } });
      return this.loadGroup(client, id);
    });
  }

  listGroups(tenantId: string): Promise<ProviderGroupDetail[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<GroupRow>(`${GROUP_SELECT} ORDER BY id`);
      return res.rows.map(toGroupDetail);
    });
  }

  addGroupMember(tenantId: string, groupId: string, dto: AddGroupMemberDto, actor: Actor): Promise<{ status: 'ok' }> {
    return this.db.withTenant(tenantId, async (client) => {
      await this.assertExists(client, 'provider_groups', groupId, 'Group');
      if (dto.org_id) await this.assertExists(client, 'provider_orgs', dto.org_id, 'Provider');
      if (dto.agent_id) await this.assertExists(client, 'provider_agents', dto.agent_id, 'Agent');
      // Idempotent via the unique index (migration 0017): a duplicate is a no-op.
      const ins = await client.query(
        `INSERT INTO provider_group_members (tenant_id, group_id, org_id, agent_id) VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING RETURNING tenant_id`,
        [tenantId, groupId, dto.org_id ?? null, dto.agent_id ?? null],
      );
      if ((ins.rowCount ?? 0) > 0) {
        await this.outbox.emit(client, { type: 'group.changed', tenantId, actor, data: { group_id: groupId, action: 'member_added' } });
      }
      return { status: 'ok' };
    });
  }

  private async assertExists(client: PoolClient, table: 'provider_groups' | 'provider_orgs' | 'provider_agents', id: string, label: string): Promise<void> {
    const res = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
    if ((res.rowCount ?? 0) === 0) throw new AppException('not_found', { detail: `${label} not found` });
  }

  // --- Merchant status webhook (docs/06, Q9) ---

  async processMerchantWebhook(
    tenantId: string,
    dto: MerchantWebhookDto,
    verify: { receivedSecret: string; sourceIp?: string },
  ): Promise<{ status: 'ok' }> {
    const ok =
      this.config.moyasarWebhookSecret.length > 0 &&
      this.integrations.payments.verifyWebhook({
        sharedSecret: this.config.moyasarWebhookSecret,
        receivedSecret: verify.receivedSecret,
        // Always forward the IP so an allowlist fails closed on an unknown source.
        sourceIp: verify.sourceIp ?? '',
        ...(this.config.webhookAllowedIps.length ? { allowedIps: this.config.webhookAllowedIps } : {}),
      });
    if (!ok) throw new AppException('unauthorized', { detail: 'Webhook verification failed' });

    await this.db.withTenant(tenantId, async (client) => {
      const inserted = await client.query(
        `INSERT INTO webhook_events (id, tenant_id, source, event_id, event_type, payload)
         VALUES ($1, $2, 'moyasar', $3, 'merchant.status_changed', $4::jsonb)
         ON CONFLICT (tenant_id, source, event_id) DO NOTHING RETURNING id`,
        [uuidv7(), tenantId, dto.event_id, j(dto)],
      );
      if ((inserted.rowCount ?? 0) === 0) return; // already processed (exactly once)

      const upd = await client.query<{ id: string }>(
        `UPDATE provider_orgs SET moyasar_status = $2 WHERE moyasar_merchant_id = $1 RETURNING id`,
        [dto.merchant_id, dto.status],
      );
      const org = upd.rows[0];
      if (org) {
        await this.outbox.emit(client, {
          type: 'merchant.status_changed',
          tenantId,
          actor: { type: 'system' },
          data: { provider_org_id: org.id, merchant_id: dto.merchant_id, status: dto.status },
        });
      }
      await client.query(
        `UPDATE webhook_events SET processed_at = now() WHERE tenant_id = $1 AND source = 'moyasar' AND event_id = $2`,
        [tenantId, dto.event_id],
      );
    });
    return { status: 'ok' };
  }

  private async loadGroup(client: PoolClient, id: string): Promise<ProviderGroupDetail> {
    const res = await client.query<GroupRow>(`${GROUP_SELECT} WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) throw new AppException('not_found', { detail: 'Group not found' });
    return toGroupDetail(row);
  }
}

const GROUP_SELECT = `SELECT id, vertical_id, name, description FROM provider_groups`;
interface GroupRow {
  id: string;
  vertical_id: string | null;
  name: TranslatableText;
  description: TranslatableText | null;
}
function toGroupDetail(r: GroupRow): ProviderGroupDetail {
  return { id: r.id, vertical_id: r.vertical_id, name: r.name, description: r.description };
}
