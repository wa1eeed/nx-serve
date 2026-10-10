import type pg from 'pg';
import { uuidv7 } from '@nxserve/domain';
import { type TemplatePayload } from '@nxserve/contracts';

/** Ids created by installing a template, keyed by their code. */
export interface InstallResult {
  verticalId: string;
  workflowId: string;
  categoryIds: Record<string, string>;
  tierIds: Record<string, string>;
  paymentPlanIds: Record<string, string>;
  itemCatalogIds: Record<string, string>;
}

const j = (value: unknown): string => JSON.stringify(value);

/**
 * Applies a template payload into a tenant as editable rows (docs/10 section 9).
 * Used by the API install endpoint (inside a tenant transaction) and by the seed
 * (as the super admin). Pure SQL inserts; the caller owns the transaction.
 */
export async function applyTemplate(
  client: pg.ClientBase,
  tenantId: string,
  payload: TemplatePayload,
): Promise<InstallResult> {
  const paymentPlanIds: Record<string, string> = {};
  for (const plan of payload.payment_plans) {
    const id = uuidv7();
    await client.query(
      `INSERT INTO payment_plans (id, tenant_id, code, kind, params) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [id, tenantId, plan.code, plan.kind, j(plan.params ?? {})],
    );
    paymentPlanIds[plan.code] = id;
  }

  const workflowId = uuidv7();
  await client.query(
    `INSERT INTO workflow_definitions (id, tenant_id, name) VALUES ($1, $2, $3::jsonb)`,
    [workflowId, tenantId, j(payload.workflow.name)],
  );
  for (const stage of payload.workflow.stages) {
    await client.query(
      `INSERT INTO workflow_stages
         (id, tenant_id, workflow_id, code, label, maps_to, sort_order, actor, tracking_active, requires, payment_action, notify, sla_minutes)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11, $12::jsonb, $13)`,
      [
        uuidv7(),
        tenantId,
        workflowId,
        stage.code,
        j(stage.label),
        stage.maps_to,
        stage.sort_order,
        stage.actor,
        stage.tracking_active,
        j(stage.requires ?? {}),
        stage.payment_action,
        j(stage.notify ?? {}),
        stage.sla_minutes ?? null,
      ],
    );
  }

  const verticalId = uuidv7();
  await client.query(
    `INSERT INTO verticals (id, tenant_id, code, name, default_fulfillment, default_tracking, workflow_id, config)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb)`,
    [
      verticalId,
      tenantId,
      payload.vertical.code,
      j(payload.vertical.name),
      payload.vertical.default_fulfillment,
      payload.vertical.default_tracking,
      workflowId,
      j(payload.vertical.config ?? {}),
    ],
  );

  const categoryIds: Record<string, string> = {};
  for (const cat of payload.categories) {
    const id = uuidv7();
    await client.query(
      `INSERT INTO categories (id, tenant_id, vertical_id, parent_id, fulfillment, tracking, code, name, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
      [
        id,
        tenantId,
        verticalId,
        cat.parent_code ? (categoryIds[cat.parent_code] ?? null) : null,
        cat.fulfillment ?? null,
        cat.tracking ?? null,
        cat.code,
        j(cat.name),
        cat.sort_order,
      ],
    );
    categoryIds[cat.code] = id;
  }

  const itemCatalogIds: Record<string, string> = {};
  for (const cat of payload.item_catalogs) {
    const id = uuidv7();
    await client.query(
      `INSERT INTO item_catalogs (id, tenant_id, vertical_id, code, name) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [id, tenantId, verticalId, cat.code, j(cat.name)],
    );
    itemCatalogIds[cat.code] = id;
    for (const item of cat.items) {
      await client.query(
        `INSERT INTO catalog_items (id, tenant_id, catalog_id, code, name, size_class, pricing_units, attributes, allow_custom)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9)`,
        [
          uuidv7(),
          tenantId,
          id,
          item.code,
          j(item.name),
          item.size_class ?? null,
          item.pricing_units,
          j(item.attributes ?? {}),
          item.allow_custom,
        ],
      );
    }
  }

  for (const field of payload.fields) {
    const options = field.options
      ? field.options.map((o) => ({ value: o.value, label_en: o.label.en, label_ar: o.label['ar'] ?? o.label.en }))
      : null;
    await client.query(
      `INSERT INTO attribute_definitions
         (id, tenant_id, vertical_id, category_id, scope, key, label, data_type, options, validation,
          is_required, used_in_pricing, used_in_matching, match_rule, visibility_rule, item_catalog_id,
          reference_source, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17, $18)`,
      [
        uuidv7(),
        tenantId,
        verticalId,
        field.category_code ? (categoryIds[field.category_code] ?? null) : null,
        field.scope,
        field.key,
        j(field.label),
        field.data_type,
        options ? j(options) : null,
        field.validation ? j(field.validation) : null,
        field.required,
        field.used_in_pricing,
        field.used_in_matching,
        field.match_rule ? j(field.match_rule) : null,
        field.visibility_rule ? j(field.visibility_rule) : null,
        field.item_catalog_code ? (itemCatalogIds[field.item_catalog_code] ?? null) : null,
        field.reference_source ?? null,
        field.sort_order,
      ],
    );
  }

  const tierIds: Record<string, string> = {};
  for (const tier of payload.tiers) {
    const id = uuidv7();
    await client.query(
      `INSERT INTO service_tiers
         (id, tenant_id, vertical_id, category_id, code, name, description, required_capabilities, pricing_mode, payment_plan_id, max_stops, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9, $10, $11, $12)`,
      [
        id,
        tenantId,
        verticalId,
        tier.category_code ? (categoryIds[tier.category_code] ?? null) : null,
        tier.code,
        j(tier.name),
        tier.description ? j(tier.description) : null,
        j(tier.required_capabilities ?? {}),
        tier.pricing_mode,
        tier.payment_plan_code ? (paymentPlanIds[tier.payment_plan_code] ?? null) : null,
        tier.max_stops,
        tier.sort_order,
      ],
    );
    tierIds[tier.code] = id;
  }

  for (const req of payload.requirements) {
    await client.query(
      `INSERT INTO category_requirements (id, tenant_id, category_id, doc_type, label, applies_to, is_required, expires)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        uuidv7(),
        tenantId,
        categoryIds[req.category_code] ?? null,
        req.doc_type,
        j(req.label),
        req.applies_to,
        req.is_required,
        req.expires,
      ],
    );
  }

  return { verticalId, workflowId, categoryIds, tierIds, paymentPlanIds, itemCatalogIds };
}
