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
 * End-to-end tests for the Phase 1 catalog write paths, exercised over HTTP
 * against the real NestJS app and a live PostgreSQL + PostGIS database: the full
 * pipeline (tenancy resolution, access token, permission guard, Zod validation,
 * RLS, transactional outbox). They run only when the database is provisioned
 * (DATABASE_URL set, migrated and seeded), which is the case in the CI database
 * job; otherwise they skip. See .github/workflows/ci.yml.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const SUPERADMIN_URL = process.env.DATABASE_SUPERADMIN_URL;
const enabled = Boolean(DATABASE_URL && SUPERADMIN_URL);

const SECRET = 'e2e-access-secret';
const rand = (): string => Math.random().toString(36).slice(2, 8);

interface Call {
  status: number;
  body: Record<string, unknown> | Record<string, unknown>[] | undefined;
}

describe.skipIf(!enabled)('catalog write paths (e2e)', () => {
  let app: NestFastifyApplication;
  let admin: pg.Client;

  let demoTenantId: string;
  let demoStaffId: string;
  let nxTenantId: string;
  let nxStaffId: string;
  let limitedStaffId: string;

  let demoToken: string;
  let nxToken: string;
  let limitedToken: string;

  async function mint(staffId: string, tenantId: string): Promise<string> {
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
    opts: { token?: string; host?: string; body?: unknown } = {},
  ): Promise<Call> {
    const headers: Record<string, string> = { host: opts.host ?? 'demo.localhost' };
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

    demoTenantId = (await admin.query<{ id: string }>(`SELECT id FROM tenants WHERE slug = 'demo'`)).rows[0]!.id;
    demoStaffId = (
      await admin.query<{ id: string }>(`SELECT id FROM staff_users WHERE email = $1`, ['owner@demo.localhost'])
    ).rows[0]!.id;
    nxTenantId = (await admin.query<{ id: string }>(`SELECT id FROM tenants WHERE slug = 'nxserve'`)).rows[0]!.id;

    // A staff user with catalog.manage in the platform-owner tenant, for the
    // cross-tenant isolation checks (resolved via nxserve.localhost).
    nxStaffId = uuidv7();
    const nxRoleId = uuidv7();
    await admin.query(`INSERT INTO staff_users (id, tenant_id, full_name, email) VALUES ($1, $2, 'NX Owner', $3)`, [
      nxStaffId,
      nxTenantId,
      `nx-${rand()}@nxserve.localhost`,
    ]);
    await admin.query(
      `INSERT INTO roles (id, tenant_id, scope, code, name, is_system) VALUES ($1, $2, 'tenant', $3, '{"en":"Owner"}'::jsonb, true)`,
      [nxRoleId, nxTenantId, `owner_${rand()}`],
    );
    await admin.query(`INSERT INTO role_permissions (tenant_id, role_id, permission_code) VALUES ($1, $2, 'catalog.manage')`, [
      nxTenantId,
      nxRoleId,
    ]);
    await admin.query(`INSERT INTO user_role_assignments (tenant_id, user_id, role_id) VALUES ($1, $2, $3)`, [
      nxTenantId,
      nxStaffId,
      nxRoleId,
    ]);

    // A demo staff user WITHOUT catalog.manage (only catalog.view), for the
    // permission-denied check with a valid tenant and token.
    limitedStaffId = uuidv7();
    const limitedRoleId = uuidv7();
    await admin.query(`INSERT INTO staff_users (id, tenant_id, full_name, email) VALUES ($1, $2, 'Demo Viewer', $3)`, [
      limitedStaffId,
      demoTenantId,
      `viewer-${rand()}@demo.localhost`,
    ]);
    await admin.query(
      `INSERT INTO roles (id, tenant_id, scope, code, name, is_system) VALUES ($1, $2, 'tenant', $3, '{"en":"Viewer"}'::jsonb, false)`,
      [limitedRoleId, demoTenantId, `viewer_${rand()}`],
    );
    await admin.query(`INSERT INTO role_permissions (tenant_id, role_id, permission_code) VALUES ($1, $2, 'catalog.view')`, [
      demoTenantId,
      limitedRoleId,
    ]);
    await admin.query(`INSERT INTO user_role_assignments (tenant_id, user_id, role_id) VALUES ($1, $2, $3)`, [
      demoTenantId,
      limitedStaffId,
      limitedRoleId,
    ]);

    demoToken = await mint(demoStaffId, demoTenantId);
    nxToken = await mint(nxStaffId, nxTenantId);
    limitedToken = await mint(limitedStaffId, demoTenantId);

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

  it('runs the full catalog write lifecycle and reflects it in the form schema', async () => {
    const h = { token: demoToken };
    const code = `e2e_tow_${rand()}`;

    // Create a vertical.
    const created = await call('POST', '/v1/admin/verticals', {
      ...h,
      body: {
        code,
        name: { en: 'E2E Towing', ar: 'سطحات اختبار' },
        default_fulfillment: 'point_to_point',
        default_tracking: 'full_trip',
      },
    });
    expect(created.status).toBe(201);
    const verticalId = (created.body as { id: string }).id;
    expect(verticalId).toBeTruthy();

    // Read it back (raw, management shape).
    const got = await call('GET', `/v1/admin/verticals/${verticalId}`, h);
    expect(got.status).toBe(200);
    expect((got.body as { code: string }).code).toBe(code);
    expect((got.body as { is_active: boolean }).is_active).toBe(true);

    // Add two fields, one conditional on the other (show_if).
    const f1 = await call('POST', `/v1/admin/verticals/${verticalId}/fields`, {
      ...h,
      body: { key: 'is_basement', data_type: 'boolean', label: { en: 'In a basement', ar: 'في قبو' }, required: false },
    });
    expect(f1.status).toBe(201);
    const fieldId = (f1.body as { id: string }).id;

    const f2 = await call('POST', `/v1/admin/verticals/${verticalId}/fields`, {
      ...h,
      body: {
        key: 'clearance_m',
        data_type: 'number',
        label: { en: 'Clearance (m)', ar: 'الارتفاع (م)' },
        required: true,
        visibility_rule: { show_if: { key: 'is_basement', eq: true } },
      },
    });
    expect(f2.status).toBe(201);

    const fields = await call('GET', `/v1/admin/verticals/${verticalId}/fields`, h);
    expect(fields.status).toBe(200);
    expect((fields.body as unknown[]).length).toBe(2);

    // Add a category.
    const cat = await call('POST', `/v1/admin/verticals/${verticalId}/categories`, {
      ...h,
      body: { code: 'light', name: { en: 'Light vehicles', ar: 'مركبات خفيفة' } },
    });
    expect(cat.status).toBe(201);
    const categories = await call('GET', `/v1/admin/verticals/${verticalId}/categories`, h);
    expect((categories.body as unknown[]).length).toBe(1);

    // Create a workflow and stages.
    const wf = await call('POST', `/v1/admin/verticals/${verticalId}/workflow`, {
      ...h,
      body: { name: { en: 'Towing flow', ar: 'مسار السطحة' } },
    });
    expect(wf.status).toBe(201);
    const workflowId = (wf.body as { id: string }).id;

    const s1 = await call('POST', `/v1/admin/workflows/${workflowId}/stages`, {
      ...h,
      body: { code: 'accepted', label: { en: 'Accepted', ar: 'تم القبول' }, maps_to: 'assigned' },
    });
    expect(s1.status).toBe(201);
    const stage1 = (s1.body as { id: string }).id;

    const s2 = await call('POST', `/v1/admin/workflows/${workflowId}/stages`, {
      ...h,
      body: { code: 'en_route', label: { en: 'En route', ar: 'في الطريق' }, maps_to: 'en_route', tracking_active: true },
    });
    expect(s2.status).toBe(201);
    const stage2 = (s2.body as { id: string }).id;

    // Reorder: put stage2 first.
    const reorder = await call('POST', `/v1/admin/workflows/${workflowId}/stages/reorder`, {
      ...h,
      body: { order: [stage2, stage1] },
    });
    expect(reorder.status).toBe(200);

    const wfAfter = await call('GET', `/v1/admin/verticals/${verticalId}/workflow`, h);
    expect(wfAfter.status).toBe(200);
    const stages = (wfAfter.body as { stages: { id: string; sort_order: number }[] }).stages;
    expect(stages.length).toBe(2);
    expect(stages[0]!.id).toBe(stage2);

    // Update and delete a stage.
    const patchStage = await call('PATCH', `/v1/admin/stages/${stage1}`, { ...h, body: { tracking_active: true } });
    expect(patchStage.status).toBe(200);
    const delStage = await call('DELETE', `/v1/admin/stages/${stage2}`, h);
    expect(delStage.status).toBe(200);
    const wfFinal = await call('GET', `/v1/admin/verticals/${verticalId}/workflow`, h);
    expect((wfFinal.body as { stages: unknown[] }).stages.length).toBe(1);

    // The order form the console/storefront consumes reflects the new fields.
    const form = await app.inject({
      method: 'GET',
      url: `/v1/catalog/verticals/${verticalId}/form`,
      headers: { host: 'demo.localhost', 'accept-language': 'en', authorization: `Bearer ${demoToken}` },
    });
    expect(form.statusCode).toBe(200);
    const schema = JSON.parse(form.body) as {
      fulfillment: string;
      sections: { key: string; fields: { key: string; visibility?: unknown }[] }[];
    };
    expect(schema.fulfillment).toBe('point_to_point');
    const service = schema.sections.find((s) => s.key === 'service')!;
    const keys = service.fields.map((f) => f.key);
    expect(keys).toContain('is_basement');
    expect(keys).toContain('clearance_m');
    expect(service.fields.find((f) => f.key === 'clearance_m')!.visibility).toBeTruthy();

    // Update the vertical, delete a field, then soft-delete the vertical.
    const patchV = await call('PATCH', `/v1/admin/verticals/${verticalId}`, {
      ...h,
      body: { name: { en: 'E2E Towing Updated', ar: 'سطحات محدثة' } },
    });
    expect(patchV.status).toBe(200);
    const delField = await call('DELETE', `/v1/admin/fields/${fieldId}`, h);
    expect(delField.status).toBe(200);
    const delVertical = await call('DELETE', `/v1/admin/verticals/${verticalId}`, h);
    expect(delVertical.status).toBe(200);
    const afterDelete = await call('GET', `/v1/admin/verticals/${verticalId}`, h);
    expect(afterDelete.status).toBe(404);

    // The writes emitted domain events through the transactional outbox.
    const outbox = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM outbox_events WHERE tenant_id = $1 AND type LIKE 'catalog.%'`,
      [demoTenantId],
    );
    expect(Number(outbox.rows[0]!.n)).toBeGreaterThan(0);
  });

  describe('authorization', () => {
    const body = {
      code: `e2e_na_${rand()}`,
      name: { en: 'No auth', ar: 'بدون' },
      default_fulfillment: 'at_customer',
      default_tracking: 'none',
    };

    it('rejects an anonymous write with permission_denied', async () => {
      const res = await call('POST', '/v1/admin/verticals', { body });
      expect(res.status).toBe(403);
      expect((res.body as { code: string }).code).toBe('permission_denied');
    });

    it('rejects a staff member who lacks catalog.manage', async () => {
      const res = await call('POST', '/v1/admin/verticals', { token: limitedToken, body });
      expect(res.status).toBe(403);
      expect((res.body as { code: string }).code).toBe('permission_denied');
    });

    it('rejects a token whose tenant does not match the host', async () => {
      // Token is for the nxserve tenant, but the host resolves to demo.
      const res = await call('POST', '/v1/admin/verticals', { token: nxToken, host: 'demo.localhost', body });
      expect(res.status).toBe(403);
      expect((res.body as { code: string }).code).toBe('forbidden');
    });
  });

  describe('tenant isolation (RLS)', () => {
    it('hides another tenant rows from the admin endpoints', async () => {
      // Create a vertical in the demo tenant.
      const created = await call('POST', '/v1/admin/verticals', {
        token: demoToken,
        body: {
          code: `e2e_iso_${rand()}`,
          name: { en: 'Isolated', ar: 'معزول' },
          default_fulfillment: 'at_customer',
          default_tracking: 'none',
        },
      });
      expect(created.status).toBe(201);
      const verticalId = (created.body as { id: string }).id;

      // The platform-owner tenant (nxserve) cannot read or delete it.
      const crossRead = await call('GET', `/v1/admin/verticals/${verticalId}`, {
        token: nxToken,
        host: 'nxserve.localhost',
      });
      expect(crossRead.status).toBe(404);

      const crossDelete = await call('DELETE', `/v1/admin/verticals/${verticalId}`, {
        token: nxToken,
        host: 'nxserve.localhost',
      });
      expect(crossDelete.status).toBe(404);

      // The owning tenant still sees it.
      const ownRead = await call('GET', `/v1/admin/verticals/${verticalId}`, { token: demoToken });
      expect(ownRead.status).toBe(200);
    });
  });
});
