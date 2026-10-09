import type pg from 'pg';
import { uuidv7 } from '@nxserve/domain';

/**
 * Seeds reference and demo data so the full towing scenario can run locally.
 * Runs as the super admin role (BYPASSRLS). Translatable text is stored as
 * jsonb {en, ar}; money as bigint minor units (halalas). geoMode 'null' lets the
 * structural linter run this without PostGIS.
 */
export interface SeedOptions {
  geoMode?: 'postgis' | 'null';
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export async function runSeed(client: pg.ClientBase, options: SeedOptions = {}): Promise<void> {
  const geoMode = options.geoMode ?? 'postgis';

  // Helper: build a geography value placeholder from WKT, or NULL in lint mode.
  const geo = (wkt: string, params: unknown[]): string => {
    if (geoMode === 'null') return 'NULL';
    params.push(`SRID=4326;${wkt}`);
    return `ST_GeogFromText($${params.length})`;
  };
  const j = (value: Json): string => JSON.stringify(value);

  await client.query('BEGIN');
  try {
    // ---------------- Global reference data ----------------
    const bodySedan = uuidv7();
    const bodySuv = uuidv7();
    const bodyPickup = uuidv7();
    for (const [id, code, en, ar] of [
      [bodySedan, 'sedan', 'Sedan', 'سيدان'],
      [bodySuv, 'suv', 'SUV', 'دفع رباعي'],
      [bodyPickup, 'pickup', 'Pickup', 'بيك أب'],
    ] as const) {
      await client.query(
        `INSERT INTO vehicle_body_types (id, code, name) VALUES ($1, $2, $3::jsonb)`,
        [id, code, j({ en, ar })],
      );
    }

    const makeToyota = uuidv7();
    await client.query(`INSERT INTO vehicle_makes (id, code, name) VALUES ($1, 'toyota', $2::jsonb)`, [
      makeToyota,
      j({ en: 'Toyota', ar: 'تويوتا' }),
    ]);
    const modelCamry = uuidv7();
    const modelLc = uuidv7();
    await client.query(
      `INSERT INTO vehicle_models (id, make_id, code, name, body_type_id, year_from, drivetrain, default_class)
       VALUES ($1, $2, 'camry', $3::jsonb, $4, 2015, 'fwd', 'standard'),
              ($5, $2, 'land_cruiser', $6::jsonb, $7, 2015, 'awd', 'luxury')`,
      [modelCamry, makeToyota, j({ en: 'Camry', ar: 'كامري' }), bodySedan, modelLc, j({ en: 'Land Cruiser', ar: 'لاند كروزر' }), bodySuv],
    );

    // Cities with rough boundaries (small boxes around each centre).
    const cityRiyadh = uuidv7();
    const cityJeddah = uuidv7();
    const cityDammam = uuidv7();
    for (const [id, _code, en, ar, box] of [
      [cityRiyadh, 'riyadh', 'Riyadh', 'الرياض', '46.5 24.5,47.1 24.5,47.1 25.1,46.5 25.1,46.5 24.5'],
      [cityJeddah, 'jeddah', 'Jeddah', 'جدة', '39.0 21.3,39.3 21.3,39.3 21.8,39.0 21.8,39.0 21.3'],
      [cityDammam, 'dammam', 'Dammam', 'الدمام', '49.9 26.3,50.2 26.3,50.2 26.6,49.9 26.6,49.9 26.3'],
    ] as const) {
      const params: unknown[] = [id, j({ en, ar })];
      const g = geo(`MULTIPOLYGON(((${box})))`, params);
      await client.query(
        `INSERT INTO cities (id, name, country_code, boundary) VALUES ($1, $2::jsonb, 'SA', ${g})`,
        params,
      );
    }

    // Modules, limits, permissions (minimal set).
    const towingTemplate = uuidv7();
    await client.query(
      `INSERT INTO service_templates (id, code, name, description, payload, version, is_published)
       VALUES ($1, 'towing', $2::jsonb, $3::jsonb, $4::jsonb, 1, true)`,
      [towingTemplate, j({ en: 'Towing', ar: 'سطحات' }), j({ en: 'Vehicle towing', ar: 'سحب المركبات' }), j({ tiers: ['flatbed_std'] })],
    );
    const modTowing = uuidv7();
    const modTracking = uuidv7();
    const modBrandedApps = uuidv7();
    await client.query(
      `INSERT INTO modules (id, code, kind, name, template_id, is_published) VALUES
         ($1, 'towing', 'service', $2::jsonb, $5, true),
         ($3, 'live_tracking', 'capability', $4::jsonb, NULL, true),
         ($6, 'branded_apps', 'capability', $7::jsonb, NULL, true)`,
      [modTowing, j({ en: 'Towing', ar: 'سطحات' }), modTracking, j({ en: 'Live tracking', ar: 'تتبع حي' }), towingTemplate, modBrandedApps, j({ en: 'Branded apps', ar: 'تطبيقات بالعلامة' })],
    );
    await client.query(
      `INSERT INTO limit_definitions (code, name) VALUES
         ('max_providers', $1::jsonb), ('max_agents', $2::jsonb), ('orders_per_month', $3::jsonb)`,
      [j({ en: 'Max providers', ar: 'حد المزودين' }), j({ en: 'Max agents', ar: 'حد المنفذين' }), j({ en: 'Orders per month', ar: 'طلبات شهرياً' })],
    );
    for (const [code] of [
      ['orders.view'], ['orders.dispatch'], ['pricing.edit'], ['pricing.approve'],
      ['providers.approve'], ['finance.view'], ['apps.build'], ['api_keys.manage'], ['users.manage'],
    ] as const) {
      await client.query(`INSERT INTO permissions (code) VALUES ($1)`, [code]);
    }

    // Plans: starter and advanced, each one active version.
    const planStarter = uuidv7();
    const planAdvanced = uuidv7();
    const psv = uuidv7();
    const pav = uuidv7();
    await client.query(`INSERT INTO plans (id, code, name) VALUES ($1, 'starter', $2::jsonb), ($3, 'advanced', $4::jsonb)`, [
      planStarter, j({ en: 'Starter', ar: 'الأساسية' }), planAdvanced, j({ en: 'Advanced', ar: 'المتقدمة' }),
    ]);
    await client.query(
      `INSERT INTO plan_versions (id, plan_id, version, status, published_at) VALUES
         ($1, $2, 1, 'active', now()), ($3, $4, 1, 'active', now())`,
      [psv, planStarter, pav, planAdvanced],
    );
    await client.query(
      `INSERT INTO plan_modules (plan_version_id, module_id) VALUES
         ($1, $3), ($1, $4), ($2, $3), ($2, $4), ($2, $5)`,
      [psv, pav, modTowing, modTracking, modBrandedApps],
    );

    // Setting definitions (a few).
    await client.query(
      `INSERT INTO setting_definitions (key, category, data_type, default_value, editable_levels) VALUES
         ('dispatch.offer_timeout_sec', 'dispatch', 'number', $1::jsonb, ARRAY['tenant']),
         ('branding.hide_powered_by', 'branding', 'boolean', $2::jsonb, ARRAY['tenant']),
         ('orders.require_otp_on_completion', 'orders', 'boolean', $3::jsonb, ARRAY['tenant'])`,
      [j(30), j(false), j(true)],
    );

    // ---------------- Tenants ----------------
    const tenantNx = uuidv7();
    const tenantDemo = uuidv7();
    await client.query(
      `INSERT INTO tenants (id, slug, legal_name, display_name, status, is_platform_owner) VALUES
         ($1, 'nxserve', 'NX Solutions', 'NX Serve', 'active', true),
         ($2, 'demo', 'Demo Services Co', 'Demo Towing', 'active', false)`,
      [tenantNx, tenantDemo],
    );
    await client.query(
      `INSERT INTO tenant_domains (id, tenant_id, hostname, kind, purpose, is_primary, ssl_status) VALUES
         ($1, $2, 'nxserve.localhost', 'subdomain', 'website', true, 'active'),
         ($3, $4, 'demo.localhost', 'subdomain', 'website', true, 'active')`,
      [uuidv7(), tenantNx, uuidv7(), tenantDemo],
    );
    await client.query(
      `INSERT INTO tenant_payment_gateways (id, tenant_id, mode, environment, status) VALUES ($1, $2, 'own_platform', 'sandbox', 'pending')`,
      [uuidv7(), tenantDemo],
    );
    await client.query(
      `INSERT INTO tenant_subscriptions (id, tenant_id, plan_version_id, billing_cycle, period_start, period_end) VALUES
         ($1, $2, $3, 'monthly', current_date, current_date + 30)`,
      [uuidv7(), tenantDemo, pav],
    );

    // Demo staff: an owner with a role and all permissions, plus a test API key.
    const demoOwnerRole = uuidv7();
    await client.query(
      `INSERT INTO roles (id, tenant_id, scope, code, name, is_system) VALUES ($1, $2, 'tenant', 'owner', $3::jsonb, true)`,
      [demoOwnerRole, tenantDemo, j({ en: 'Owner', ar: 'المالك' })],
    );
    await client.query(
      `INSERT INTO role_permissions (tenant_id, role_id, permission_code)
       SELECT $1, $2, code FROM permissions`,
      [tenantDemo, demoOwnerRole],
    );
    const demoOwner = uuidv7();
    await client.query(
      `INSERT INTO staff_users (id, tenant_id, full_name, email, mfa_enabled) VALUES ($1, $2, 'Demo Owner', 'owner@demo.localhost', false)`,
      [demoOwner, tenantDemo],
    );
    await client.query(
      `INSERT INTO staff_credentials (staff_user_id, tenant_id, password_hash) VALUES ($1, $2, 'seed-placeholder-argon2id-hash')`,
      [demoOwner, tenantDemo],
    );
    await client.query(`INSERT INTO user_role_assignments (tenant_id, user_id, role_id) VALUES ($1, $2, $3)`, [
      tenantDemo, demoOwner, demoOwnerRole,
    ]);
    await client.query(
      `INSERT INTO api_clients (id, tenant_id, name, client_id, secret_hash, scopes, environment) VALUES
         ($1, $2, 'Demo test key', 'nx_test_demo', 'seed-placeholder-secret-hash', ARRAY['orders:read','orders:write'], 'sandbox')`,
      [uuidv7(), tenantDemo],
    );

    // ---------------- Demo towing configuration (template installed) ----------------
    const wf = uuidv7();
    await client.query(`INSERT INTO workflow_definitions (id, tenant_id, name) VALUES ($1, $2, $3::jsonb)`, [
      wf, tenantDemo, j({ en: 'Towing workflow', ar: 'سير عمل السطحة' }),
    ]);
    const stages: [string, string, string, string, number, boolean, string][] = [
      ['accepted', 'Accepted', 'تم القبول', 'assigned', 1, false, 'authorize'],
      ['heading_to_pickup', 'Heading to pickup', 'في الطريق للاستلام', 'en_route', 2, true, 'none'],
      ['arrived_pickup', 'Arrived at pickup', 'وصل نقطة الاستلام', 'arrived', 3, false, 'none'],
      ['loading', 'Loading', 'جارٍ التحميل', 'in_progress', 4, false, 'none'],
      ['heading_to_dropoff', 'Heading to drop-off', 'في الطريق للتسليم', 'in_progress', 5, true, 'none'],
      ['delivered', 'Delivered', 'تم التسليم', 'completed', 6, false, 'capture'],
    ];
    for (const [code, en, ar, mapsTo, order, tracking, action] of stages) {
      await client.query(
        `INSERT INTO workflow_stages (id, tenant_id, workflow_id, code, label, maps_to, sort_order, tracking_active, payment_action)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
        [uuidv7(), tenantDemo, wf, code, j({ en, ar }), mapsTo, order, tracking, action],
      );
    }

    const vertTowing = uuidv7();
    await client.query(
      `INSERT INTO verticals (id, tenant_id, code, name, default_fulfillment, default_tracking, workflow_id)
       VALUES ($1, $2, 'towing', $3::jsonb, 'point_to_point', 'full_trip', $4)`,
      [vertTowing, tenantDemo, j({ en: 'Towing', ar: 'سطحات' }), wf],
    );
    const catLight = uuidv7();
    await client.query(
      `INSERT INTO categories (id, tenant_id, vertical_id, code, name) VALUES ($1, $2, $3, 'light_vehicles', $4::jsonb)`,
      [catLight, tenantDemo, vertTowing, j({ en: 'Light vehicles', ar: 'مركبات خفيفة' })],
    );
    await client.query(
      `INSERT INTO tenant_template_installs (id, tenant_id, template_id, version, vertical_id) VALUES ($1, $2, $3, 1, $4)`,
      [uuidv7(), tenantDemo, towingTemplate, vertTowing],
    );

    const planAuthCap = uuidv7();
    await client.query(
      `INSERT INTO payment_plans (id, tenant_id, code, kind) VALUES ($1, $2, 'authorize_capture', 'authorize_capture')`,
      [planAuthCap, tenantDemo],
    );
    const tierFlatbed = uuidv7();
    await client.query(
      `INSERT INTO service_tiers (id, tenant_id, vertical_id, category_id, code, name, pricing_mode, payment_plan_id, max_stops)
       VALUES ($1, $2, $3, $4, 'flatbed_std', $5::jsonb, 'upfront', $6, 2)`,
      [tierFlatbed, tenantDemo, vertTowing, catLight, j({ en: 'Standard flatbed', ar: 'سطحة عادية' }), planAuthCap],
    );

    const classEconomy = uuidv7();
    const classLuxury = uuidv7();
    await client.query(
      `INSERT INTO vehicle_classes (id, tenant_id, code, name, sort_order) VALUES
         ($1, $2, 'economy', $3::jsonb, 1), ($4, $2, 'luxury', $5::jsonb, 2)`,
      [classEconomy, tenantDemo, j({ en: 'Economy', ar: 'اقتصادية' }), classLuxury, j({ en: 'Luxury', ar: 'فاخرة' })],
    );
    await client.query(
      `INSERT INTO vehicle_class_map (tenant_id, model_id, class_id) VALUES ($1, $2, $3), ($1, $4, $5)`,
      [tenantDemo, modelCamry, classEconomy, modelLc, classLuxury],
    );

    await client.query(
      `INSERT INTO service_availability (id, tenant_id, vertical_id, category_id, tier_id, city_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [uuidv7(), tenantDemo, vertTowing, catLight, tierFlatbed, cityRiyadh],
    );

    // Rate card reproducing the docs/09 worked example inputs (money in halalas).
    await client.query(
      `INSERT INTO rate_cards (id, tenant_id, tier_id, city_id, vehicle_class_id, currency,
          base_fare_minor, included_km, per_km, approach_per_km, approach_free_km, per_min,
          class_multiplier, auth_buffer_pct, rounding, minimum_fare_minor, status, valid_from)
       VALUES ($1, $2, $3, $4, $5, 'SAR', 8000, 5, 4, 2, 5, 0.5, 1.3, 15, 'nearest_1', 5000, 'active', now())`,
      [uuidv7(), tenantDemo, tierFlatbed, cityRiyadh, classLuxury],
    );

    const feeSchedule = uuidv7();
    await client.query(
      `INSERT INTO fee_schedules (id, tenant_id, name, vertical_id, currency, gateway_fee_bearer, status, valid_from)
       VALUES ($1, $2, $3::jsonb, $4, 'SAR', 'provider', 'active', now())`,
      [feeSchedule, tenantDemo, j({ en: 'Default fees', ar: 'الرسوم الافتراضية' }), vertTowing],
    );
    await client.query(
      `INSERT INTO fee_components (id, tenant_id, schedule_id, code, label, bearer, calc, rate_pct, base, vat_mode)
       VALUES ($1, $2, $3, 'platform_commission', $4::jsonb, 'provider', 'percent', 10, 'service_amount', 'inclusive')`,
      [uuidv7(), tenantDemo, feeSchedule, j({ en: 'Platform commission', ar: 'عمولة المنصة' })],
    );

    await client.query(
      `INSERT INTO dispatch_policies (id, tenant_id, vertical_id, mode, params) VALUES
         ($1, $2, $3, 'auto_nearest', $4::jsonb)`,
      [uuidv7(), tenantDemo, vertTowing, j({ radius_km: 10, offer_timeout_sec: 30, rounds: 3 })],
    );

    // ---------------- Demo provider, agent, asset, offering ----------------
    const org = uuidv7();
    await client.query(
      `INSERT INTO provider_orgs (id, tenant_id, entity_type, legal_name, display_name, city_id, moyasar_merchant_id, moyasar_status)
       VALUES ($1, $2, 'freelancer', 'Ahmed Towing', 'Ahmed Towing', $3, 'sandbox_merchant_1', 'active')`,
      [org, tenantDemo, cityRiyadh],
    );
    const agent = uuidv7();
    await client.query(
      `INSERT INTO provider_agents (id, tenant_id, org_id, full_name, mobile, role) VALUES ($1, $2, $3, 'Ahmed', '+966500000010', 'owner')`,
      [agent, tenantDemo, org],
    );
    const asset = uuidv7();
    await client.query(
      `INSERT INTO assets (id, tenant_id, org_id, vertical_id, asset_type, identifier, attributes)
       VALUES ($1, $2, $3, $4, 'flatbed', 'ABC-1234', $5::jsonb)`,
      [asset, tenantDemo, org, vertTowing, j({ max_weight_kg: 3500, hydraulic: false })],
    );
    await client.query(`INSERT INTO agent_assets (tenant_id, agent_id, asset_id) VALUES ($1, $2, $3)`, [
      tenantDemo, agent, asset,
    ]);
    await client.query(
      `INSERT INTO provider_offerings (id, tenant_id, org_id, vertical_id, category_id, capabilities, status)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'approved')`,
      [uuidv7(), tenantDemo, org, vertTowing, catLight, j({ asset_type: ['flatbed'] })],
    );

    // ---------------- Demo customer ----------------
    const customer = uuidv7();
    await client.query(
      `INSERT INTO customers (id, tenant_id, full_name, mobile) VALUES ($1, $2, 'Test Customer', '+966500000020')`,
      [customer, tenantDemo],
    );
    await client.query(
      `INSERT INTO customer_vehicles (id, tenant_id, customer_id, model_id, year, plate, is_default)
       VALUES ($1, $2, $3, $4, 2020, 'XYZ-5678', true)`,
      [uuidv7(), tenantDemo, customer, modelCamry],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
