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
 * End-to-end acceptance for Phase 4 increment 2b (docs/07): manual assignment starts
 * the workflow, and the assigned agent advances the stages with proof. Capture is a
 * later increment, so the run stops at the delivery proof gate. Runs in the CI
 * database job; skips without a database.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const SUPERADMIN_URL = process.env.DATABASE_SUPERADMIN_URL;
const enabled = Boolean(DATABASE_URL && SUPERADMIN_URL);
const SECRET = 'e2e-access-secret';

interface Call {
  status: number;
  body: Record<string, unknown> | undefined;
}

describe.skipIf(!enabled)('orders workflow (e2e)', () => {
  let app: NestFastifyApplication;
  let admin: pg.Client;
  let tenantId: string;
  let verticalId: string;
  let tierId: string;
  let cityId: string;
  let rateCardId: string | null;
  let orgId: string;
  let agentId: string;
  let customerToken: string;
  let agentToken: string;
  let staffToken: string;
  let customerId: string;

  function mint(sub: string, typ: 'customer' | 'agent' | 'staff'): Promise<string> {
    return new SignJWT({ typ, tid: tenantId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(SECRET));
  }

  async function call(method: 'GET' | 'POST', url: string, opts: { token?: string; body?: unknown } = {}): Promise<Call> {
    const headers: Record<string, string> = { host: 'demo.localhost' };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (method === 'POST') headers['idempotency-key'] = randomUUID();
    const res = await app.inject({ method, url, headers, ...(opts.body !== undefined ? { payload: opts.body as object } : {}) });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
  }

  async function seedEstimate(): Promise<string> {
    const id = uuidv7();
    await admin.query(
      `INSERT INTO price_estimates
         (id, tenant_id, vertical_id, tier_id, city_id, currency, inputs, breakdown,
          service_fare_minor, customer_total_minor, authorized_minor, surge_multiplier, rate_card_id, expires_at)
       VALUES ($1,$2,$3,$4,$5,'SAR','{}'::jsonb,'{}'::jsonb,26400,26400,30400,1,$6, now() + interval '5 minutes')`,
      [id, tenantId, verticalId, tierId, cityId, rateCardId],
    );
    return id;
  }

  async function createOrder(): Promise<string> {
    const estimateId = await seedEstimate();
    const res = await call('POST', '/v1/orders', {
      token: customerToken,
      body: {
        estimate_id: estimateId,
        stops: [
          { lat: 24.71, lng: 46.68, kind: 'pickup' },
          { lat: 24.79, lng: 46.74, kind: 'dropoff' },
        ],
        terms_accepted: true,
      },
    });
    expect(res.status).toBe(201);
    return (res.body as { id: string }).id;
  }

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    process.env.PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? 'localhost';

    admin = new pg.Client({ connectionString: SUPERADMIN_URL });
    await admin.connect();
    tenantId = (await admin.query<{ id: string }>(`SELECT id FROM tenants WHERE slug = 'demo'`)).rows[0]!.id;
    verticalId = (await admin.query<{ id: string }>(`SELECT id FROM verticals WHERE tenant_id = $1 AND code = 'towing'`, [tenantId])).rows[0]!.id;
    tierId = (await admin.query<{ id: string }>(`SELECT id FROM service_tiers WHERE tenant_id = $1 AND code = 'flatbed_std'`, [tenantId])).rows[0]!.id;
    cityId = (await admin.query<{ id: string }>(`SELECT id FROM cities WHERE name->>'en' = 'Riyadh' LIMIT 1`)).rows[0]!.id;
    rateCardId = (await admin.query<{ id: string }>(`SELECT id FROM rate_cards WHERE tenant_id = $1 AND status = 'active' LIMIT 1`, [tenantId])).rows[0]?.id ?? null;
    orgId = (await admin.query<{ id: string }>(`SELECT id FROM provider_orgs WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`, [tenantId])).rows[0]!.id;
    agentId = (await admin.query<{ id: string }>(`SELECT id FROM provider_agents WHERE tenant_id = $1 AND org_id = $2 LIMIT 1`, [tenantId, orgId])).rows[0]!.id;
    const staffId = (await admin.query<{ id: string }>(`SELECT id FROM staff_users WHERE email = 'owner@demo.localhost'`)).rows[0]!.id;

    customerId = uuidv7();
    await admin.query(`INSERT INTO customers (id, tenant_id, mobile) VALUES ($1,$2,$3)`, [customerId, tenantId, `+9665${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`]);

    customerToken = await mint(customerId, 'customer');
    agentToken = await mint(agentId, 'agent');
    staffToken = await mint(staffId, 'staff');

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

  it('assigns a provider and advances the stages to the delivery proof gate', async () => {
    const orderId = await createOrder();

    // Staff can read any order; a customer-only route would not serve them.
    expect((await call('GET', `/v1/admin/orders/${orderId}`, { token: staffToken })).status).toBe(200);

    // Ops manually assigns the provider, which starts the workflow (authorize on accept).
    const assigned = await call('POST', `/v1/admin/orders/${orderId}/assign`, { token: staffToken, body: { org_id: orgId, agent_id: agentId } });
    expect(assigned.status).toBe(200);
    const a = assigned.body as { status: string; current_stage_code: string; payment_action: string };
    expect(a.status).toBe('assigned');
    expect(a.current_stage_code).toBe('accepted');
    expect(a.payment_action).toBe('authorize');

    // The assigned agent advances; tracking turns on heading to pickup.
    const s1 = await call('POST', `/v1/orders/${orderId}/advance`, { token: agentToken, body: {} });
    expect(s1.status).toBe(200);
    expect((s1.body as { current_stage_code: string; status: string; tracking_active: boolean }).current_stage_code).toBe('heading_to_pickup');
    expect((s1.body as { status: string }).status).toBe('en_route');
    expect((s1.body as { tracking_active: boolean }).tracking_active).toBe(true);

    // A non-assigned agent cannot advance.
    const stranger = await mint(uuidv7(), 'agent');
    expect((await call('POST', `/v1/orders/${orderId}/advance`, { token: stranger, body: {} })).status).toBe(403);

    expect((await call('POST', `/v1/orders/${orderId}/advance`, { token: agentToken, body: {} })).body?.['current_stage_code']).toBe('arrived_pickup');

    // Leaving arrived_pickup needs 2 photos: without them it is rejected, with them it proceeds.
    expect((await call('POST', `/v1/orders/${orderId}/advance`, { token: agentToken, body: { proof: { photos: 1 } } })).status).toBe(422);
    expect((await call('POST', `/v1/orders/${orderId}/advance`, { token: agentToken, body: { proof: { photos: 2 } } })).body?.['current_stage_code']).toBe('loading');

    expect((await call('POST', `/v1/orders/${orderId}/advance`, { token: agentToken, body: {} })).body?.['current_stage_code']).toBe('heading_to_dropoff');

    // The delivery proof gate (OTP + photos) blocks capture until the OTP is verified.
    const gate = await call('POST', `/v1/orders/${orderId}/advance`, { token: agentToken, body: { proof: { photos: 2 } } });
    expect(gate.status).toBe(422);
  });

  it('rejects assignment of an order that is not awaiting dispatch', async () => {
    const orderId = await createOrder();
    expect((await call('POST', `/v1/admin/orders/${orderId}/assign`, { token: staffToken, body: { org_id: orgId, agent_id: agentId } })).status).toBe(200);
    // Second assign: already assigned.
    expect((await call('POST', `/v1/admin/orders/${orderId}/assign`, { token: staffToken, body: { org_id: orgId, agent_id: agentId } })).status).toBe(409);
  });

  it('denies the admin order routes to a non-staff caller', async () => {
    const orderId = await createOrder();
    expect((await call('GET', `/v1/admin/orders/${orderId}`, { token: agentToken })).status).toBe(403);
  });
});
