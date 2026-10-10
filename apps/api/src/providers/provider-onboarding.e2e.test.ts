import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import pg from 'pg';
import { SignJWT } from 'jose';
import { uuidv7 } from '@nxserve/domain';
import { AppModule } from '../app.module.js';

/**
 * End-to-end acceptance for Phase 2 (docs/15): a provider goes from signup to
 * "eligible for dispatch" in sandbox, over HTTP against the real app and a live
 * PostgreSQL + PostGIS database. Runs in the CI database job; skips without a
 * database (quality job, local without Docker), like the catalog write e2e.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const SUPERADMIN_URL = process.env.DATABASE_SUPERADMIN_URL;
const enabled = Boolean(DATABASE_URL && SUPERADMIN_URL);

const SECRET = 'e2e-access-secret';
const WEBHOOK_SECRET = 'e2e-webhook-secret';
const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');
const rand = (): string => Math.random().toString(36).slice(2, 8);
const randomMobile = (): string => `+9665${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;

interface Call {
  status: number;
  body: Record<string, unknown> | Record<string, unknown>[] | undefined;
}

describe.skipIf(!enabled)('provider onboarding (e2e)', () => {
  let app: NestFastifyApplication;
  let admin: pg.Client;
  let demoTenantId: string;
  let demoStaffId: string;
  let staffToken: string;
  let verticalId: string;
  let categoryId: string;

  async function mint(staffId: string, tenantId: string, type: 'staff' | 'agent'): Promise<string> {
    return new SignJWT({ typ: type, tid: tenantId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(staffId)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(SECRET));
  }

  async function call(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    opts: { token?: string; host?: string; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<Call> {
    const headers: Record<string, string> = { host: opts.host ?? 'demo.localhost', ...(opts.headers ?? {}) };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await app.inject({
      method,
      url,
      headers,
      ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
    });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
  }

  async function seedOtp(mobile: string): Promise<string> {
    const id = uuidv7();
    await admin.query(
      `INSERT INTO otp_challenges (id, tenant_id, subject_type, mobile, code_hash, expires_at)
       VALUES ($1, $2, 'agent', $3, $4, now() + interval '5 minutes')`,
      [id, demoTenantId, mobile, sha256('123456')],
    );
    return id;
  }

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    process.env.MOYASAR_WEBHOOK_SHARED_SECRET = WEBHOOK_SECRET;
    process.env.PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? 'localhost';

    admin = new pg.Client({ connectionString: SUPERADMIN_URL });
    await admin.connect();
    demoTenantId = (await admin.query<{ id: string }>(`SELECT id FROM tenants WHERE slug = 'demo'`)).rows[0]!.id;
    demoStaffId = (
      await admin.query<{ id: string }>(`SELECT id FROM staff_users WHERE email = $1`, ['owner@demo.localhost'])
    ).rows[0]!.id;
    verticalId = (
      await admin.query<{ id: string }>(`SELECT id FROM verticals WHERE tenant_id = $1 AND code = 'towing'`, [demoTenantId])
    ).rows[0]!.id;
    categoryId = (
      await admin.query<{ id: string }>(
        `SELECT id FROM categories WHERE tenant_id = $1 AND code = 'light_vehicles'`,
        [demoTenantId],
      )
    ).rows[0]!.id;
    staffToken = await mint(demoStaffId, demoTenantId, 'staff');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await admin?.end();
  });

  it('onboards a provider from signup to eligible for dispatch', async () => {
    const mobile = randomMobile();
    const challengeId = await seedOtp(mobile);

    // 1. Register (OTP verified): starts NX Verify, creates the sandbox merchant.
    const reg = await call('POST', '/v1/providers/register', {
      body: {
        challenge_id: challengeId,
        code: '123456',
        entity_type: 'freelancer',
        legal_name: 'E2E Tow Co',
        display_name: 'E2E Tow',
        iban: 'SA0380000000608010167519',
        owner: { full_name: 'E2E Owner', mobile },
      },
    });
    expect(reg.status).toBe(201);
    const body = reg.body as { org: { id: string; moyasar_status: string; moyasar_merchant_id: string }; tokens: { access_token: string } };
    expect(body.org.moyasar_status).toBe('active'); // fake sandbox merchant
    const ownerToken = body.tokens.access_token;
    const orgId = body.org.id;
    const merchantId = body.org.moyasar_merchant_id;

    // 2. Apply for a towing offering (owner).
    const off = await call('POST', '/v1/providers/me/offerings', {
      token: ownerToken,
      body: { vertical_id: verticalId, category_id: categoryId, capabilities: { asset_type: ['flatbed'] } },
    });
    expect(off.status).toBe(201);
    const offeringId = (off.body as { id: string }).id;

    // 3. Upload the required documents (owner).
    for (const docType of ['vehicle_registration', 'operating_permit']) {
      const up = await call('POST', '/v1/providers/me/documents', {
        token: ownerToken,
        body: {
          doc_type: docType,
          applies_to: 'org',
          file_url: 'https://files.example/doc.pdf',
          ...(docType === 'operating_permit' ? { expires_on: '2030-01-01' } : {}),
        },
      });
      expect(up.status).toBe(201);
    }

    // 4. Admin approves the offering and verifies the documents.
    expect((await call('POST', `/v1/admin/offerings/${offeringId}/review`, { token: staffToken, body: { decision: 'approve' } })).status).toBe(200);
    const docs = await call('GET', `/v1/admin/providers/${orgId}/documents`, { token: staffToken });
    for (const d of docs.body as { id: string }[]) {
      expect((await call('POST', `/v1/admin/documents/${d.id}/review`, { token: staffToken, body: { decision: 'verify' } })).status).toBe(200);
    }

    // 5. The provider is now eligible for dispatch.
    const me = await call('GET', '/v1/providers/me', { token: ownerToken });
    expect(me.status).toBe(200);
    const onboarding = (me.body as { onboarding: { eligible_for_dispatch: boolean; state: string } }).onboarding;
    expect(onboarding.eligible_for_dispatch).toBe(true);
    expect(onboarding.state).toBe('active');

    // 6. The merchant webhook updates status and is processed exactly once.
    const eventId = `evt_${rand()}`;
    const wh = await call('POST', '/v1/webhooks/merchant', {
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      body: { event_id: eventId, merchant_id: merchantId, status: 'active' },
    });
    expect(wh.status).toBe(200);
    const dup = await call('POST', '/v1/webhooks/merchant', {
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      body: { event_id: eventId, merchant_id: merchantId, status: 'active' },
    });
    expect(dup.status).toBe(200); // idempotent
  });

  it('rejects provider self service without an agent token', async () => {
    const res = await call('POST', '/v1/providers/me/offerings', { body: { vertical_id: verticalId, capabilities: {} } });
    expect(res.status).toBe(401);
  });

  it('rejects admin review without the providers.approve permission', async () => {
    const res = await call('GET', '/v1/admin/providers', {});
    expect(res.status).toBe(403);
    expect((res.body as { code: string }).code).toBe('permission_denied');
  });

  it('rejects a merchant webhook with a bad secret', async () => {
    const res = await call('POST', '/v1/webhooks/merchant', {
      headers: { 'x-webhook-secret': 'wrong' },
      body: { event_id: `evt_${rand()}`, merchant_id: 'x', status: 'active' },
    });
    expect(res.status).toBe(401);
  });
});
