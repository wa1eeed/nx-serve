import { Injectable } from '@nestjs/common';
import {
  type FieldValidationRules,
  type FormSchema,
  type FulfillmentMode,
  type ServiceFieldDef,
  type TrackingMode,
  type TranslatedText,
  type VisibilityRule,
  buildFormSchema,
} from '@nxserve/domain';
import { DbService } from '../db/db.service.js';
import { EntitlementsService } from '../authz/entitlements.service.js';

export interface VerticalSummary {
  id: string;
  code: string;
  name: TranslatedText;
  default_fulfillment: FulfillmentMode;
  default_tracking: TrackingMode;
  is_active: boolean;
}

interface VerticalRow {
  id: string;
  code: string;
  name: TranslatedText;
  default_fulfillment: FulfillmentMode;
  default_tracking: TrackingMode;
  is_active: boolean;
}

interface FieldRow {
  key: string;
  data_type: ServiceFieldDef['dataType'];
  is_required: boolean;
  label: TranslatedText;
  options: { value: string; label_en: string; label_ar?: string }[] | null;
  validation: Record<string, unknown> | null;
  visibility_rule: { show_if?: { key: string; eq?: unknown; ne?: unknown; in?: unknown[] } } | null;
  reference_source: string | null;
  version: number;
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly db: DbService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async listVerticals(tenantId: string): Promise<VerticalSummary[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<VerticalRow>(
        `SELECT id, code, name, default_fulfillment, default_tracking, is_active
         FROM verticals WHERE is_active = true ORDER BY created_at`,
      );
      return res.rows.map((r) => ({ ...r }));
    });
  }

  /** The merged, localized order form schema for a vertical, or null if missing. */
  async getVerticalForm(
    tenantId: string,
    verticalId: string,
    locale: 'ar' | 'en',
  ): Promise<FormSchema | null> {
    const entitledModules = await this.entitlements.getEffectiveModules(tenantId);
    return this.db.withTenant(tenantId, async (client) => {
      const v = await client.query<VerticalRow>(
        `SELECT id, code, name, default_fulfillment, default_tracking, is_active
         FROM verticals WHERE id = $1 AND is_active = true`,
        [verticalId],
      );
      const vertical = v.rows[0];
      if (!vertical) return null;

      const fields = await client.query<FieldRow>(
        `SELECT key, data_type, is_required, label, options, validation, visibility_rule, reference_source, version
         FROM attribute_definitions
         WHERE vertical_id = $1 AND scope = 'order' AND is_active = true
           AND review_status = 'approved' AND owner_org_id IS NULL
         ORDER BY sort_order`,
        [verticalId],
      );

      const serviceFields = fields.rows.map(mapField);
      return buildFormSchema({
        version: computeVersion(fields.rows),
        locale,
        fulfillment: vertical.default_fulfillment,
        tracking: vertical.default_tracking,
        serviceFields,
        entitledModules,
      });
    });
  }
}

function computeVersion(rows: readonly FieldRow[]): string {
  let max = 0;
  for (const r of rows) if (r.version > max) max = r.version;
  return `v${rows.length}-${max}`;
}

function mapField(row: FieldRow): ServiceFieldDef {
  const def: ServiceFieldDef = {
    key: row.key,
    dataType: row.data_type,
    required: row.is_required,
    label: row.label,
  };
  if (row.options) {
    def.options = row.options.map((o) => ({
      value: o.value,
      label: { en: o.label_en, ...(o.label_ar ? { ar: o.label_ar } : {}) },
    }));
  }
  if (row.validation) {
    def.validation = row.validation as FieldValidationRules;
  }
  const showIf = row.visibility_rule?.show_if;
  if (showIf) {
    const rule: VisibilityRule = { key: showIf.key };
    if ('eq' in showIf) rule.eq = showIf.eq;
    if ('ne' in showIf) rule.ne = showIf.ne;
    if (showIf.in) rule.in = showIf.in;
    def.visibility = rule;
  }
  if (row.reference_source) def.referenceSource = row.reference_source;
  return def;
}
