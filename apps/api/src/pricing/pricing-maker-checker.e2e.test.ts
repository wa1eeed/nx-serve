import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import pg from 'pg';
import { SignJWT } from 'jose';
import { uuidv7 } from '@nxserve/domain';
import { AppModule } from '../app.module.js';

/**
 * End-to-end acceptance for Phase 3 (docs/15): rate cards and fee schedules move
 * through maker-checker (the approver can never be the creator), a surge schedule
 * is configured, and a public estimate resolves the approved card and is stored
 * with a short expiry. Runs in the CI database job; skips without a database,
 * like the other e2e suites.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const SUPERADMIN_URL = process.env.DATABASE_SUPERADMIN_URL;
const enabled = Boolean(DATABASE_URL && SUPERADMIN_URL);

const SECRET = 'e2e-access-secret';

interface Call {
  status: number;
  body: Record<string, unknown> | Record<string, unknown>[] | undefined;
}

describe.skipIf(!enabled)('pricing maker-checker and estimate (e2e)', () => {
  let app: NestFastifyApplication;
  let admin: pg.Client;
  let tenantId: string;
  let makerId: string;
  let checkerId: string;
  let makerToken: string;
  let checkerToken: string;
  let tierId: string;
  let cityId: string;
  let verticalId: string;

  function mint(staffId: string): Promise<string> {
    return new SignJWT({ typ: 'staff', tid: tenantId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(staffId)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(SECRET));
  }

  async function call(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    opts: { token?: string; body?: unknown } = {},
  ): Promise<Call> {
    const headers: Record<string, string> = { host: 'demo.localhost' };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (method === 'POST') headers['idempotency-key'] = randomUUID(); // required on tenant POSTs
    const res = await app.inject({
      method,
      url,
      headers,
      ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
    });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
  }

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    process.env.PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? 'localhost';

    admin = new pg.Client({ connectionString: SUPERADMIN_URL });
    await admin.connect();
    tenantId = (await admin.query<{ id: string }>(`SELECT id FROM tenants WHERE slug = 'demo'`)).rows[0]!.id;
    makerId = (await admin.query<{ id: string }>(`SELECT id FROM staff_users WHERE email = $1`, ['owner@demo.localhost'])).rows[0]!.id;
    const roleId = (await admin.query<{ id: string }>(`SELECT id FROM roles WHERE tenant_id = $1 AND code = 'owner'`, [tenantId])).rows[0]!.id;
    tierId = (await admin.query<{ id: string }>(`SELECT id FROM service_tiers WHERE tenant_id = $1 AND code = 'flatbed_std'`, [tenantId])).rows[0]!.id;
    cityId = (await admin.query<{ id: string }>(`SELECT id FROM cities WHERE name->>'en' = 'Riyadh' LIMIT 1`)).rows[0]!.id;
    verticalId = (await admin.query<{ id: string }>(`SELECT id FROM verticals WHERE tenant_id = $1 AND code = 'towing'`, [tenantId])).rows[0]!.id;

    // A second staff member with the same (full) role, to act as the checker.
    checkerId = uuidv7();
    await admin.query(
      `INSERT INTO staff_users (id, tenant_id, full_name, email, mfa_enabled) VALUES ($1, $2, 'Demo Checker', $3, false)`,
      [checkerId, tenantId, `checker-${checkerId.slice(0, 8)}@demo.localhost`],
    );
    await admin.query(`INSERT INTO user_role_assignments (tenant_id, user_id, role_id) VALUES ($1, $2, $3)`, [tenantId, checkerId, roleId]);

    makerToken = await mint(makerId);
    checkerToken = await mint(checkerId);

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

  it('enforces maker-checker on a rate card and then prices an estimate against it', async () => {
    // 1. Maker creates a draft rate card (city-level, no vehicle class).
    const created = await call('POST', '/v1/admin/pricing/rate-cards', {
      token: makerToken,
      body: {
        tier_id: tierId,
        city_id: cityId,
        base_fare_minor: '8000',
        included_km: 5,
        per_km: 4,
        per_min: 0.5,
        minimum_fare_minor: '5000',
        class_multiplier: 1.3,
        auth_buffer_pct: 15,
        rounding: 'nearest_1',
      },
    });
    expect(created.status).toBe(201);
    const card = created.body as { id: string; status: string; created_by: string };
    expect(card.status).toBe('draft');
    expect(card.created_by).toBe(makerId);
    const cardId = card.id;

    // 2. Maker submits it for approval.
    const submitted = await call('POST', `/v1/admin/pricing/rate-cards/${cardId}/submit`, { token: makerToken });
    expect(submitted.status).toBe(200);
    expect((submitted.body as { status: string }).status).toBe('pending_approval');

    // 3. Four-eyes: editing a pending card reverts it to draft, so approval always
    // binds to the content the checker reviews. The maker must resubmit.
    const edited = await call('PATCH', `/v1/admin/pricing/rate-cards/${cardId}`, { token: makerToken, body: { per_km: 5 } });
    expect(edited.status).toBe(200);
    expect((edited.body as { status: string }).status).toBe('draft');
    expect((await call('POST', `/v1/admin/pricing/rate-cards/${cardId}/submit`, { token: makerToken })).status).toBe(200);

    // 4. The creator cannot approve their own card (maker-checker).
    const selfApprove = await call('POST', `/v1/admin/pricing/rate-cards/${cardId}/approve`, { token: makerToken, body: {} });
    expect(selfApprove.status).toBe(409);

    // 5. A different staff member approves it; it becomes active.
    const approved = await call('POST', `/v1/admin/pricing/rate-cards/${cardId}/approve`, { token: checkerToken, body: {} });
    expect(approved.status).toBe(200);
    const active = approved.body as { status: string; approved_by: string };
    expect(active.status).toBe('active');
    expect(active.approved_by).toBe(checkerId);

    // 6. A public estimate resolves the approved card and is stored with an expiry.
    const est = await call('POST', '/v1/estimates', {
      body: {
        vertical_id: verticalId,
        tier_id: tierId,
        city_id: cityId,
        stops: [
          { lat: 24.71, lng: 46.68 },
          { lat: 24.79, lng: 46.74 },
        ],
      },
    });
    expect(est.status).toBe(201);
    const quote = est.body as { estimate_id: string; service_fare_minor: string; authorized_minor: string; expires_at: string };
    expect(quote.estimate_id).toBeTruthy();
    expect(BigInt(quote.service_fare_minor)).toBeGreaterThan(0n);
    expect(BigInt(quote.authorized_minor)).toBeGreaterThanOrEqual(BigInt(quote.service_fare_minor));
    expect(new Date(quote.expires_at).getTime()).toBeGreaterThan(Date.now());

    // The estimate row is persisted for this tenant.
    const stored = await admin.query(`SELECT 1 FROM price_estimates WHERE id = $1 AND tenant_id = $2`, [quote.estimate_id, tenantId]);
    expect(stored.rowCount).toBe(1);
  });

  it('runs a fee schedule through maker-checker with its components', async () => {
    const created = await call('POST', '/v1/admin/pricing/fee-schedules', {
      token: makerToken,
      body: {
        name: { en: 'E2E city fees', ar: 'رسوم المدينة' },
        city_id: cityId,
        gateway_fee_bearer: 'provider',
        components: [
          { code: 'platform_commission', label: { en: 'Commission', ar: 'عمولة' }, bearer: 'provider', calc: 'percent', rate_pct: 12, base: 'service_amount', vat_mode: 'inclusive' },
        ],
      },
    });
    expect(created.status).toBe(201);
    const sched = created.body as { id: string; status: string; components: unknown[] };
    expect(sched.status).toBe('draft');
    expect(sched.components).toHaveLength(1);

    expect((await call('POST', `/v1/admin/pricing/fee-schedules/${sched.id}/submit`, { token: makerToken })).status).toBe(200);
    // Self-approval is blocked; the checker approves.
    expect((await call('POST', `/v1/admin/pricing/fee-schedules/${sched.id}/approve`, { token: makerToken, body: {} })).status).toBe(409);
    const approved = await call('POST', `/v1/admin/pricing/fee-schedules/${sched.id}/approve`, { token: checkerToken, body: {} });
    expect(approved.status).toBe(200);
    expect((approved.body as { status: string }).status).toBe('active');
  });

  it('configures a surge schedule', async () => {
    const created = await call('POST', '/v1/admin/pricing/surge-schedules', {
      token: makerToken,
      body: { name: { en: 'Friday peak', ar: 'ذروة الجمعة' }, tier_id: tierId, days_of_week: [5], multiplier: 1.2 },
    });
    expect(created.status).toBe(201);
    const surgeId = (created.body as { id: string; multiplier: number }).id;
    expect((created.body as { multiplier: number }).multiplier).toBe(1.2);

    const list = await call('GET', '/v1/admin/pricing/surge-schedules', { token: makerToken });
    expect(list.status).toBe(200);
    expect((list.body as { id: string }[]).some((s) => s.id === surgeId)).toBe(true);
  });

  it('rejects pricing writes without the permission', async () => {
    const res = await call('POST', '/v1/admin/pricing/rate-cards', { body: { tier_id: tierId, city_id: cityId } });
    expect(res.status).toBe(403);
  });
});
