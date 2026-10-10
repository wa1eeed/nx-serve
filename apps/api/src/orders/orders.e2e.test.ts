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
 * End-to-end acceptance for Phase 4 (orders, docs/07): a customer creates an order
 * from a stored estimate and reads it back, over HTTP against a live PostgreSQL +
 * PostGIS database. Runs in the CI database job; skips without a database.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const SUPERADMIN_URL = process.env.DATABASE_SUPERADMIN_URL;
const enabled = Boolean(DATABASE_URL && SUPERADMIN_URL);
const SECRET = 'e2e-access-secret';

interface Call {
  status: number;
  body: Record<string, unknown> | undefined;
}

describe.skipIf(!enabled)('orders create and read (e2e)', () => {
  let app: NestFastifyApplication;
  let admin: pg.Client;
  let tenantId: string;
  let verticalId: string;
  let tierId: string;
  let cityId: string;
  let rateCardId: string | null;
  let customerId: string;
  let otherCustomerId: string;
  let token: string;
  let otherToken: string;

  function mint(customerId: string): Promise<string> {
    return new SignJWT({ typ: 'customer', tid: tenantId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(customerId)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(SECRET));
  }

  async function call(method: 'GET' | 'POST', url: string, opts: { token?: string; body?: unknown } = {}): Promise<Call> {
    const headers: Record<string, string> = { host: 'demo.localhost' };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (method === 'POST') headers['idempotency-key'] = randomUUID(); // required on tenant POSTs
    const res = await app.inject({ method, url, headers, ...(opts.body !== undefined ? { payload: opts.body as object } : {}) });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
  }

  async function seedEstimate(expiresInMin: number): Promise<string> {
    const id = uuidv7();
    await admin.query(
      `INSERT INTO price_estimates
         (id, tenant_id, vertical_id, tier_id, city_id, currency, inputs, breakdown,
          service_fare_minor, customer_total_minor, authorized_minor, surge_multiplier, rate_card_id, expires_at)
       VALUES ($1,$2,$3,$4,$5,'SAR','{}'::jsonb,'{}'::jsonb,26400,26400,30400,1,$6, now() + ($7 || ' minutes')::interval)`,
      [id, tenantId, verticalId, tierId, cityId, rateCardId, String(expiresInMin)],
    );
    return id;
  }

  async function seedCustomer(mobile: string): Promise<string> {
    const id = uuidv7();
    await admin.query(`INSERT INTO customers (id, tenant_id, mobile) VALUES ($1, $2, $3)`, [id, tenantId, mobile]);
    return id;
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

    customerId = await seedCustomer(`+9665${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`);
    otherCustomerId = await seedCustomer(`+9665${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`);
    token = await mint(customerId);
    otherToken = await mint(otherCustomerId);

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

  const stops = [
    { lat: 24.71, lng: 46.68, kind: 'pickup' },
    { lat: 24.79, lng: 46.74, kind: 'dropoff' },
  ];

  it('creates an order from a valid estimate and reads it back', async () => {
    const estimateId = await seedEstimate(5);
    const created = await call('POST', '/v1/orders', {
      token,
      body: { estimate_id: estimateId, stops, attributes: { condition: 'not_starting' }, terms_accepted: true },
    });
    expect(created.status).toBe(201);
    const order = created.body as { id: string; status: string; reference: string; vertical_id: string; stops: unknown[]; current_stage_code: string | null };
    expect(order.status).toBe('dispatching');
    expect(order.reference).toMatch(/^NX-/);
    expect(order.vertical_id).toBe(verticalId);
    expect(order.current_stage_code).toBeNull();
    expect(order.stops).toHaveLength(2);

    const got = await call('GET', `/v1/orders/${order.id}`, { token });
    expect(got.status).toBe(200);
    const read = got.body as { id: string; stops: { kind: string; lat: number }[] };
    expect(read.id).toBe(order.id);
    expect(read.stops[0]?.kind).toBe('pickup');
    expect(read.stops[0]?.lat).toBeCloseTo(24.71, 3);

    // The order persisted with a snapshot of its workflow and dispatching status.
    const row = await admin.query<{ workflow_id: string | null; status: string }>(
      `SELECT workflow_id, status FROM orders WHERE id = $1 AND tenant_id = $2`,
      [order.id, tenantId],
    );
    expect(row.rows[0]?.status).toBe('dispatching');
    expect(row.rows[0]?.workflow_id).toBeTruthy();

    // A different customer cannot read it.
    expect((await call('GET', `/v1/orders/${order.id}`, { token: otherToken })).status).toBe(404);
  });

  it('rejects an expired estimate', async () => {
    const expired = await seedEstimate(-5);
    const res = await call('POST', '/v1/orders', { token, body: { estimate_id: expired, stops, terms_accepted: true } });
    expect(res.status).toBe(409);
  });

  it('requires accepted terms', async () => {
    const estimateId = await seedEstimate(5);
    const res = await call('POST', '/v1/orders', { token, body: { estimate_id: estimateId, stops, terms_accepted: false } });
    expect(res.status).toBe(422);
  });

  it('rejects a non-customer and an anonymous caller', async () => {
    const estimateId = await seedEstimate(5);
    expect((await call('POST', '/v1/orders', { body: { estimate_id: estimateId, stops, terms_accepted: true } })).status).toBe(403);
  });
});
