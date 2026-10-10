import { Inject, Injectable } from '@nestjs/common';
import { type PoolClient } from '@nxserve/db';
import {
  type FieldDefinition,
  type FieldValidationRules,
  resolveDocuments,
  resolveOnboarding,
  uuidv7,
  validateFields,
  type DocReviewStatus,
  type DocScope,
  type IdentityStatus,
  type MerchantStatus,
  type OfferingStatus,
} from '@nxserve/domain';
import {
  type AgentDetail,
  type ApplyOfferingDto,
  type AssetDetail,
  type CreateAgentDto,
  type CreateAssetDto,
  type DocumentDetail,
  type LinkAgentAssetDto,
  type OfferingDetail,
  type OnboardingStatus,
  type PresenceDto,
  type ProviderOrgDetail,
  type RegisterProviderDto,
  type UploadDocumentDto,
} from '@nxserve/contracts';
import { type Integrations } from '@nxserve/integrations';
import { DbService } from '../db/db.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { AppException } from '../common/app-exception.js';
import { type Actor } from '../context/request-context.js';
import { INTEGRATIONS } from '../integrations/integrations.module.js';
import { OtpService } from '../auth/otp.service.js';
import { TokenService, type TokenPair } from '../auth/token.service.js';
import { EntitlementsService } from '../authz/entitlements.service.js';

interface AgentContext {
  agentId: string;
  orgId: string;
  role: string;
  isActive: boolean;
}

const j = (value: unknown): string => JSON.stringify(value);

/** Provider self service (docs/08): the actor is the provider owner (agent). */
@Injectable()
export class ProvidersService {
  constructor(
    private readonly db: DbService,
    private readonly outbox: OutboxService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly entitlements: EntitlementsService,
    @Inject(INTEGRATIONS) private readonly integrations: Integrations,
  ) {}

  /** The tenant plan limit value, or null when unlimited. Resolved outside any tx. */
  private async limitValue(tenantId: string, key: 'max_providers' | 'max_agents'): Promise<number | null> {
    const { limits } = await this.entitlements.getEffective(tenantId);
    return limits[key] ?? null;
  }

  /** Throws limit_exceeded when the active-row count has reached a pre-fetched cap. */
  private async enforceCount(
    client: PoolClient,
    max: number | null,
    table: 'provider_orgs' | 'provider_agents',
    key: string,
  ): Promise<void> {
    if (max === null) return;
    const res = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE is_active = true`);
    if ((res.rows[0]?.n ?? 0) >= max) {
      throw new AppException('limit_exceeded', { detail: `${key} reached` });
    }
  }

  // --- Registration (OTP verified signup, no existing agent) ---

  async register(
    tenantId: string,
    dto: RegisterProviderDto,
    challenge: { challengeId: string; code: string },
  ): Promise<{ org: ProviderOrgDetail; tokens: TokenPair }> {
    const otp = await this.otp.verify(challenge.challengeId, challenge.code);
    if (otp.tenantId !== tenantId || otp.subjectType !== 'agent') {
      throw new AppException('unauthorized', { detail: 'OTP does not match this tenant' });
    }
    if (dto.owner.mobile !== otp.mobile) {
      throw new AppException('validation_error', { detail: 'owner.mobile must match the verified number' });
    }

    // Resolve the provider cap before any external side effect, then reject a
    // duplicate mobile or an over-limit tenant, so a retried or double-submitted
    // registration never orphans a merchant or identity check.
    const maxProviders = await this.limitValue(tenantId, 'max_providers');
    await this.db.withTenant(tenantId, async (client) => {
      const existing = await client.query(`SELECT 1 FROM provider_agents WHERE mobile = $1`, [otp.mobile]);
      if ((existing.rowCount ?? 0) > 0) {
        throw new AppException('conflict', { detail: 'This mobile already belongs to a provider' });
      }
      await this.enforceCount(client, maxProviders, 'provider_orgs', 'max_providers');
    });

    // Integration calls run before the write transaction (no network IO inside a tx).
    const identity = await this.integrations.identity.startCheck({
      subjectType: 'provider_org',
      legalName: dto.legal_name,
      ...(dto.registration_no ? { cr: dto.registration_no } : {}),
      ...(dto.national_id ? { nationalId: dto.national_id } : {}),
      iban: dto.iban,
    });
    const merchant = await this.integrations.payments.createMerchant({
      entityType: dto.entity_type,
      legalName: dto.legal_name,
      iban: dto.iban,
    });

    const orgId = uuidv7();
    const agentId = uuidv7();
    const actor: Actor = { type: 'agent', id: agentId };

    const org = await this.db.withTenant(tenantId, async (client) => {
      const existing = await client.query(`SELECT 1 FROM provider_agents WHERE mobile = $1`, [otp.mobile]);
      if ((existing.rowCount ?? 0) > 0) {
        throw new AppException('conflict', { detail: 'This mobile already belongs to a provider' });
      }
      await client.query(
        `INSERT INTO provider_orgs
           (id, tenant_id, entity_type, legal_name, display_name, registration_no, city_id,
            moyasar_merchant_id, moyasar_status, nx_verify_ref)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          orgId, tenantId, dto.entity_type, dto.legal_name, dto.display_name, dto.registration_no ?? null,
          dto.city_id ?? null, merchant.id, merchant.status, identity.ref,
        ],
      );
      await client.query(
        `INSERT INTO provider_agents (id, tenant_id, org_id, full_name, mobile, role)
         VALUES ($1,$2,$3,$4,$5,'owner')`,
        [agentId, tenantId, orgId, dto.owner.full_name, otp.mobile],
      );
      await this.outbox.emit(client, { type: 'provider.registered', tenantId, actor, data: { provider_org_id: orgId } });
      await this.outbox.emit(client, { type: 'agent.added', tenantId, actor, data: { provider_org_id: orgId, agent_id: agentId, role: 'owner' } });
      await this.outbox.emit(client, {
        type: 'merchant.status_changed',
        tenantId,
        actor,
        data: { provider_org_id: orgId, merchant_id: merchant.id, status: merchant.status },
      });
      return this.loadOrg(client, orgId);
    });

    const tokens = await this.tokens.issue({ type: 'agent', id: agentId, tenantId });
    return { org, tokens };
  }

  // --- Self service for the authenticated owner agent ---

  async getMe(tenantId: string, agentId: string): Promise<{ org: ProviderOrgDetail; onboarding: OnboardingStatus }> {
    const orgId = await this.db.withTenant(tenantId, async (client) => (await this.loadAgentContext(client, agentId)).orgId);
    return this.onboardingForOrg(tenantId, orgId);
  }

  /** The org and its onboarding readiness, reused by the admin review screens. */
  async onboardingForOrg(tenantId: string, orgId: string): Promise<{ org: ProviderOrgDetail; onboarding: OnboardingStatus }> {
    const org = await this.db.withTenant(tenantId, (client) => this.loadOrg(client, orgId));
    // The identity check is a network call: resolve it with no transaction open,
    // then compute the rest in a short transaction (no IO inside a withTenant tx).
    const identity = await this.resolveIdentity(org.nx_verify_ref);
    const onboarding = await this.db.withTenant(tenantId, (client) => this.computeOnboarding(client, org, identity));
    return { org, onboarding };
  }

  async addAgent(tenantId: string, callerId: string, dto: CreateAgentDto): Promise<AgentDetail> {
    const maxAgents = await this.limitValue(tenantId, 'max_agents');
    return this.db.withTenant(tenantId, async (client) => {
      const ctx = await this.requireOwner(client, callerId);
      await this.enforceCount(client, maxAgents, 'provider_agents', 'max_agents');
      const id = uuidv7();
      await client.query(
        `INSERT INTO provider_agents (id, tenant_id, org_id, full_name, mobile, role) VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, tenantId, ctx.orgId, dto.full_name, dto.mobile, dto.role],
      );
      await this.outbox.emit(client, {
        type: 'agent.added',
        tenantId,
        actor: { type: 'agent', id: callerId },
        data: { provider_org_id: ctx.orgId, agent_id: id, role: dto.role },
      });
      return this.loadAgent(client, id);
    });
  }

  async addAsset(tenantId: string, callerId: string, dto: CreateAssetDto): Promise<AssetDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const ctx = await this.requireOwner(client, callerId);
      await this.validateAssetAttributes(client, dto.vertical_id, dto.attributes);
      const id = uuidv7();
      await client.query(
        `INSERT INTO assets (id, tenant_id, org_id, vertical_id, asset_type, identifier, attributes)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [id, tenantId, ctx.orgId, dto.vertical_id, dto.asset_type, dto.identifier ?? null, j(dto.attributes)],
      );
      await this.outbox.emit(client, {
        type: 'asset.added',
        tenantId,
        actor: { type: 'agent', id: callerId },
        data: { provider_org_id: ctx.orgId, asset_id: id },
      });
      return this.loadAsset(client, id);
    });
  }

  async linkAgentAsset(tenantId: string, callerId: string, dto: LinkAgentAssetDto): Promise<{ status: 'ok' }> {
    return this.db.withTenant(tenantId, async (client) => {
      const ctx = await this.requireOwner(client, callerId);
      // Both must belong to this org (RLS scopes to tenant; verify the org too).
      const ok = await client.query(
        `SELECT
           (SELECT org_id FROM provider_agents WHERE id = $1) AS agent_org,
           (SELECT org_id FROM assets WHERE id = $2) AS asset_org`,
        [dto.agent_id, dto.asset_id],
      );
      const row = ok.rows[0] as { agent_org: string | null; asset_org: string | null } | undefined;
      if (!row || row.agent_org !== ctx.orgId || row.asset_org !== ctx.orgId) {
        throw new AppException('not_found', { detail: 'Agent or asset not in this provider' });
      }
      await client.query(
        `INSERT INTO agent_assets (tenant_id, agent_id, asset_id) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [tenantId, dto.agent_id, dto.asset_id],
      );
      return { status: 'ok' };
    });
  }

  async applyOffering(tenantId: string, callerId: string, dto: ApplyOfferingDto): Promise<OfferingDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const ctx = await this.requireOwner(client, callerId);
      const id = uuidv7();
      await client.query(
        `INSERT INTO provider_offerings (id, tenant_id, org_id, vertical_id, category_id, zone_id, capabilities, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'applied')`,
        [id, tenantId, ctx.orgId, dto.vertical_id, dto.category_id ?? null, dto.zone_id ?? null, j(dto.capabilities)],
      );
      await this.outbox.emit(client, {
        type: 'offering.applied',
        tenantId,
        actor: { type: 'agent', id: callerId },
        data: { provider_org_id: ctx.orgId, offering_id: id },
      });
      return this.loadOffering(client, id);
    });
  }

  async listOfferings(tenantId: string, callerId: string): Promise<OfferingDetail[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const ctx = await this.loadAgentContext(client, callerId);
      const res = await client.query<OfferingRow>(`${OFFERING_SELECT} WHERE org_id = $1 ORDER BY id`, [ctx.orgId]);
      return res.rows.map(toOfferingDetail);
    });
  }

  async uploadDocument(tenantId: string, callerId: string, dto: UploadDocumentDto): Promise<DocumentDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const ctx = await this.requireOwner(client, callerId);
      // A document's subject must belong to this org. Foreign keys only enforce the
      // tenant, and run with RLS bypassed, so a same-tenant cross-org id would pass.
      if (dto.agent_id) await this.assertOrgOwns(client, 'provider_agents', dto.agent_id, ctx.orgId, 'Agent');
      if (dto.asset_id) await this.assertOrgOwns(client, 'assets', dto.asset_id, ctx.orgId, 'Asset');
      const id = uuidv7();
      await client.query(
        `INSERT INTO provider_documents (id, tenant_id, org_id, agent_id, asset_id, doc_type, file_url, expires_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, tenantId, ctx.orgId, dto.agent_id ?? null, dto.asset_id ?? null, dto.doc_type, dto.file_url, dto.expires_on ?? null],
      );
      await this.outbox.emit(client, {
        type: 'document.uploaded',
        tenantId,
        actor: { type: 'agent', id: callerId },
        data: { provider_org_id: ctx.orgId, document_id: id, doc_type: dto.doc_type },
      });
      return this.loadDocument(client, id);
    });
  }

  async listDocuments(tenantId: string, callerId: string): Promise<DocumentDetail[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const ctx = await this.loadAgentContext(client, callerId);
      const res = await client.query<DocumentRow>(`${DOCUMENT_SELECT} WHERE org_id = $1 ORDER BY uploaded_at`, [ctx.orgId]);
      return res.rows.map(toDocumentDetail);
    });
  }

  async updatePresence(tenantId: string, callerId: string, dto: PresenceDto): Promise<{ status: 'ok' }> {
    return this.db.withTenant(tenantId, async (client) => {
      const ctx = await this.loadAgentContext(client, callerId);
      await client.query(
        `INSERT INTO agent_presence (agent_id, tenant_id, status, location, heading, speed_kmh, updated_at)
         VALUES ($1, $2, $3,
           CASE WHEN $4::float8 IS NULL OR $5::float8 IS NULL THEN NULL
                ELSE ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography END,
           $6, $7, now())
         ON CONFLICT (agent_id) DO UPDATE
           SET status = EXCLUDED.status, location = EXCLUDED.location,
               heading = EXCLUDED.heading, speed_kmh = EXCLUDED.speed_kmh, updated_at = now()`,
        [ctx.agentId, tenantId, dto.status, dto.lat ?? null, dto.lng ?? null, dto.heading ?? null, dto.speed_kmh ?? null],
      );
      await this.outbox.emit(client, {
        type: 'presence.changed',
        tenantId,
        actor: { type: 'agent', id: callerId },
        data: { provider_org_id: ctx.orgId, agent_id: ctx.agentId, status: dto.status },
      });
      return { status: 'ok' };
    });
  }

  // --- Internals ---

  private async loadAgentContext(client: PoolClient, agentId: string): Promise<AgentContext> {
    const res = await client.query<{ org_id: string; role: string; is_active: boolean }>(
      `SELECT org_id, role, is_active FROM provider_agents WHERE id = $1`,
      [agentId],
    );
    const row = res.rows[0];
    if (!row || !row.is_active) {
      throw new AppException('unauthorized', { detail: 'No active provider agent for this actor' });
    }
    return { agentId, orgId: row.org_id, role: row.role, isActive: row.is_active };
  }

  private async requireOwner(client: PoolClient, agentId: string): Promise<AgentContext> {
    const ctx = await this.loadAgentContext(client, agentId);
    if (ctx.role !== 'owner') {
      throw new AppException('forbidden', { detail: 'Only the provider owner can manage the provider' });
    }
    return ctx;
  }

  /** Asserts a subject row belongs to the caller's org. `table` is a fixed literal. */
  private async assertOrgOwns(
    client: PoolClient,
    table: 'provider_agents' | 'assets',
    id: string,
    orgId: string,
    label: string,
  ): Promise<void> {
    const res = await client.query<{ org_id: string }>(`SELECT org_id FROM ${table} WHERE id = $1`, [id]);
    if (res.rows[0]?.org_id !== orgId) {
      throw new AppException('not_found', { detail: `${label} not in this provider` });
    }
  }

  private async validateAssetAttributes(
    client: PoolClient,
    verticalId: string,
    attributes: Record<string, unknown>,
  ): Promise<void> {
    const res = await client.query<{ key: string; data_type: FieldDefinition['dataType']; options: { value: string }[] | null; validation: Record<string, unknown> | null; is_required: boolean }>(
      `SELECT key, data_type, options, validation, is_required
       FROM attribute_definitions
       WHERE vertical_id = $1 AND scope IN ('asset', 'provider_capability')
         AND is_active = true AND review_status = 'approved' AND owner_org_id IS NULL`,
      [verticalId],
    );
    const defs: FieldDefinition[] = res.rows.map((r) => {
      const def: FieldDefinition = { key: r.key, dataType: r.data_type, required: r.is_required };
      if (r.options) def.options = r.options.map((o) => o.value);
      if (r.validation) def.validation = r.validation as FieldValidationRules;
      return def;
    });
    if (defs.length === 0) return;
    const result = validateFields(defs, attributes);
    if (!result.valid) {
      throw new AppException('validation_error', {
        detail: result.errors.map((e) => `${e.key}: ${e.message}`).join('; '),
      });
    }
  }

  private async computeOnboarding(
    client: PoolClient,
    org: ProviderOrgDetail,
    identity: IdentityStatus,
  ): Promise<OnboardingStatus> {
    const offeringsRes = await client.query<{ status: OfferingStatus; category_id: string | null }>(
      `SELECT status, category_id FROM provider_offerings WHERE org_id = $1`,
      [org.id],
    );
    const offerings = offeringsRes.rows.map((o) => ({ status: o.status }));
    const categoryIds = [...new Set(offeringsRes.rows.map((o) => o.category_id).filter((c): c is string => c !== null))];

    const requirements = categoryIds.length
      ? (
          await client.query<{ doc_type: string; applies_to: DocScope; is_required: boolean; expires: boolean }>(
            `SELECT doc_type, applies_to, is_required, expires FROM category_requirements WHERE category_id = ANY($1::uuid[])`,
            [categoryIds],
          )
        ).rows.map((r) => ({ docType: r.doc_type, appliesTo: r.applies_to, required: r.is_required, expires: r.expires }))
      : [];

    const docRows = await client.query<DocumentRow>(`${DOCUMENT_SELECT} WHERE org_id = $1`, [org.id]);
    const documents = docRows.rows.map((d) => ({
      docType: d.doc_type,
      appliesTo: (d.agent_id ? 'agent' : d.asset_id ? 'asset' : 'org') as DocScope,
      status: d.verify_status as DocReviewStatus,
      expiresOn: d.expires_on,
    }));

    const docResult = resolveDocuments({ requirements, documents, now: new Date().toISOString() });
    const onboarding = resolveOnboarding({
      orgActive: org.is_active,
      identity,
      merchant: org.moyasar_status,
      documents: {
        allRequiredSatisfied: docResult.allRequiredSatisfied,
        anyPending: docResult.pendingRequired.length > 0,
        anyBlocking: docResult.blockingRequired.length > 0,
      },
      offerings,
    });

    return {
      state: onboarding.state,
      steps: onboarding.steps,
      eligible_for_dispatch: onboarding.eligibleForDispatch,
      blockers: onboarding.blockers,
      documents: {
        all_required_satisfied: docResult.allRequiredSatisfied,
        blocking_required: docResult.blockingRequired,
        pending_required: docResult.pendingRequired,
        expiring: docResult.expiring,
        items: docResult.items.map((i) => ({
          doc_type: i.docType,
          applies_to: i.appliesTo,
          required: i.required,
          state: i.state,
          expiring_soon: i.expiringSoon,
        })),
      },
    };
  }

  private async resolveIdentity(ref: string | null): Promise<IdentityStatus> {
    if (!ref) return 'pending';
    try {
      const check = await this.integrations.identity.getCheck(ref);
      return check.status;
    } catch {
      return 'pending';
    }
  }

  private async loadOrg(client: PoolClient, id: string): Promise<ProviderOrgDetail> {
    const res = await client.query<OrgRow>(`${ORG_SELECT} WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) throw new AppException('not_found', { detail: 'Provider not found' });
    return toOrgDetail(row);
  }

  private async loadAgent(client: PoolClient, id: string): Promise<AgentDetail> {
    const res = await client.query<AgentRow>(`${AGENT_SELECT} WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) throw new AppException('not_found', { detail: 'Agent not found' });
    return toAgentDetail(row);
  }

  private async loadAsset(client: PoolClient, id: string): Promise<AssetDetail> {
    const res = await client.query<AssetRow>(`${ASSET_SELECT} WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) throw new AppException('not_found', { detail: 'Asset not found' });
    return toAssetDetail(row);
  }

  private async loadOffering(client: PoolClient, id: string): Promise<OfferingDetail> {
    const res = await client.query<OfferingRow>(`${OFFERING_SELECT} WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) throw new AppException('not_found', { detail: 'Offering not found' });
    return toOfferingDetail(row);
  }

  private async loadDocument(client: PoolClient, id: string): Promise<DocumentDetail> {
    const res = await client.query<DocumentRow>(`${DOCUMENT_SELECT} WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) throw new AppException('not_found', { detail: 'Document not found' });
    return toDocumentDetail(row);
  }
}

// --- Row shapes and selects (kept close to the detail contracts) ---

export const ORG_SELECT = `SELECT id, entity_type, legal_name, display_name, registration_no, city_id,
  moyasar_merchant_id, moyasar_status, nx_verify_ref, rating, is_active FROM provider_orgs`;
export interface OrgRow {
  id: string;
  entity_type: ProviderOrgDetail['entity_type'];
  legal_name: string;
  display_name: string;
  registration_no: string | null;
  city_id: string | null;
  moyasar_merchant_id: string | null;
  moyasar_status: MerchantStatus;
  nx_verify_ref: string | null;
  rating: string | null;
  is_active: boolean;
}
export function toOrgDetail(r: OrgRow): ProviderOrgDetail {
  return {
    id: r.id,
    entity_type: r.entity_type,
    legal_name: r.legal_name,
    display_name: r.display_name,
    registration_no: r.registration_no,
    city_id: r.city_id,
    moyasar_merchant_id: r.moyasar_merchant_id,
    moyasar_status: r.moyasar_status,
    nx_verify_ref: r.nx_verify_ref,
    rating: r.rating === null ? null : Number(r.rating),
    is_active: r.is_active,
  };
}

export const AGENT_SELECT = `SELECT id, org_id, full_name, mobile, role, rating, is_active FROM provider_agents`;
export interface AgentRow {
  id: string;
  org_id: string;
  full_name: string;
  mobile: string;
  role: AgentDetail['role'];
  rating: string | null;
  is_active: boolean;
}
export function toAgentDetail(r: AgentRow): AgentDetail {
  return {
    id: r.id,
    org_id: r.org_id,
    full_name: r.full_name,
    mobile: r.mobile,
    role: r.role,
    rating: r.rating === null ? null : Number(r.rating),
    is_active: r.is_active,
  };
}

export const ASSET_SELECT = `SELECT id, org_id, vertical_id, asset_type, identifier, attributes, is_active FROM assets`;
export interface AssetRow {
  id: string;
  org_id: string;
  vertical_id: string;
  asset_type: string;
  identifier: string | null;
  attributes: Record<string, unknown>;
  is_active: boolean;
}
export function toAssetDetail(r: AssetRow): AssetDetail {
  return {
    id: r.id,
    org_id: r.org_id,
    vertical_id: r.vertical_id,
    asset_type: r.asset_type,
    identifier: r.identifier,
    attributes: r.attributes,
    is_active: r.is_active,
  };
}

export const OFFERING_SELECT = `SELECT id, org_id, vertical_id, category_id, zone_id, capabilities, status, review_notes, is_active FROM provider_offerings`;
export interface OfferingRow {
  id: string;
  org_id: string;
  vertical_id: string;
  category_id: string | null;
  zone_id: string | null;
  capabilities: Record<string, unknown>;
  status: OfferingStatus;
  review_notes: string | null;
  is_active: boolean;
}
export function toOfferingDetail(r: OfferingRow): OfferingDetail {
  return {
    id: r.id,
    org_id: r.org_id,
    vertical_id: r.vertical_id,
    category_id: r.category_id,
    zone_id: r.zone_id,
    capabilities: r.capabilities,
    status: r.status,
    review_notes: r.review_notes,
    is_active: r.is_active,
  };
}

export const DOCUMENT_SELECT = `SELECT id, org_id, agent_id, asset_id, doc_type, file_url,
  to_char(expires_on, 'YYYY-MM-DD') AS expires_on, verify_status, uploaded_at FROM provider_documents`;
export interface DocumentRow {
  id: string;
  org_id: string;
  agent_id: string | null;
  asset_id: string | null;
  doc_type: string;
  file_url: string;
  expires_on: string | null;
  verify_status: DocumentDetail['verify_status'];
  uploaded_at: Date;
}
export function toDocumentDetail(r: DocumentRow): DocumentDetail {
  return {
    id: r.id,
    org_id: r.org_id,
    agent_id: r.agent_id,
    asset_id: r.asset_id,
    doc_type: r.doc_type,
    file_url: r.file_url,
    expires_on: r.expires_on,
    verify_status: r.verify_status,
  };
}
