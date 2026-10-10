import { Injectable } from '@nestjs/common';
import { uuidv7 } from '@nxserve/domain';
import {
  type CreateCategoryDto,
  type CreateFieldDto,
  type CreateVerticalDto,
  type UpdateCategoryDto,
  type UpdateFieldDto,
  type UpdateVerticalDto,
} from '@nxserve/contracts';
import { DbService } from '../db/db.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { AppException } from '../common/app-exception.js';
import { type Actor } from '../context/request-context.js';

export interface FieldResponse {
  id: string;
  key: string;
  data_type: string;
  label: Record<string, string>;
  required: boolean;
  version: number;
}

interface FieldRow {
  id: string;
  key: string;
  category_id: string | null;
  data_type: string;
  label: Record<string, string>;
  options: unknown;
  validation: unknown;
  visibility_rule: unknown;
  reference_source: string | null;
  item_catalog_id: string | null;
  is_required: boolean;
  used_in_pricing: boolean;
  used_in_matching: boolean;
  match_rule: unknown;
  sort_order: number;
  version: number;
}

const j = (value: unknown): string => JSON.stringify(value);

function mapOptions(options: CreateFieldDto['options']): unknown[] | null {
  if (!options) return null;
  return options.map((o) => ({ value: o.value, label_en: o.label.en, label_ar: o.label['ar'] ?? o.label.en }));
}

/** Admin writes for the dynamic field catalog (attribute_definitions), docs/05. */
@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly db: DbService,
    private readonly outbox: OutboxService,
  ) {}

  async createField(
    tenantId: string,
    verticalId: string,
    dto: CreateFieldDto,
    actor: Actor,
  ): Promise<FieldResponse> {
    return this.db.withTenant(tenantId, async (client) => {
      const v = await client.query(`SELECT 1 FROM verticals WHERE id = $1`, [verticalId]);
      if ((v.rowCount ?? 0) === 0) {
        throw new AppException('not_found', { detail: 'Vertical not found' });
      }
      const id = uuidv7();
      const options = mapOptions(dto.options);
      await client.query(
        `INSERT INTO attribute_definitions
           (id, tenant_id, vertical_id, category_id, scope, key, label, data_type, options, validation,
            is_required, used_in_pricing, used_in_matching, match_rule, visibility_rule, item_catalog_id,
            reference_source, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14::jsonb,$15::jsonb,$16,$17,$18)`,
        [
          id, tenantId, verticalId, dto.category_id ?? null, dto.scope, dto.key, j(dto.label), dto.data_type,
          options ? j(options) : null, dto.validation ? j(dto.validation) : null, dto.required,
          dto.used_in_pricing, dto.used_in_matching, dto.match_rule ? j(dto.match_rule) : null,
          dto.visibility_rule ? j(dto.visibility_rule) : null, dto.item_catalog_id ?? null,
          dto.reference_source ?? null, dto.sort_order,
        ],
      );
      await this.emit(client, tenantId, actor, id, verticalId, 'created');
      return { id, key: dto.key, data_type: dto.data_type, label: dto.label, required: dto.required, version: 1 };
    });
  }

  async updateField(
    tenantId: string,
    fieldId: string,
    dto: UpdateFieldDto,
    actor: Actor,
  ): Promise<FieldResponse> {
    return this.db.withTenant(tenantId, async (client) => {
      const cur = await client.query<FieldRow>(
        `SELECT * FROM attribute_definitions WHERE id = $1 AND owner_org_id IS NULL`,
        [fieldId],
      );
      const row = cur.rows[0];
      if (!row) {
        throw new AppException('not_found', { detail: 'Field not found' });
      }
      const label = dto.label ?? row.label;
      const required = dto.required ?? row.is_required;
      const dataType = dto.data_type ?? row.data_type;
      const sortOrder = dto.sort_order ?? row.sort_order;
      const options = dto.options !== undefined ? mapOptions(dto.options) : row.options;
      const validation = dto.validation !== undefined ? dto.validation : row.validation;
      const visibility = dto.visibility_rule !== undefined ? dto.visibility_rule : row.visibility_rule;
      const matchRule = dto.match_rule !== undefined ? dto.match_rule : row.match_rule;
      const usedPricing = dto.used_in_pricing ?? row.used_in_pricing;
      const usedMatching = dto.used_in_matching ?? row.used_in_matching;
      const referenceSource = dto.reference_source ?? row.reference_source;
      const categoryId = dto.category_id ?? row.category_id;
      const itemCatalogId = dto.item_catalog_id ?? row.item_catalog_id;
      const version = row.version + 1;

      await client.query(
        `UPDATE attribute_definitions SET
           category_id=$2, data_type=$3, label=$4::jsonb, options=$5::jsonb, validation=$6::jsonb,
           is_required=$7, used_in_pricing=$8, used_in_matching=$9, match_rule=$10::jsonb,
           visibility_rule=$11::jsonb, item_catalog_id=$12, reference_source=$13, sort_order=$14, version=$15
         WHERE id=$1`,
        [
          fieldId, categoryId, dataType, j(label), options ? j(options) : null,
          validation ? j(validation) : null, required, usedPricing, usedMatching,
          matchRule ? j(matchRule) : null, visibility ? j(visibility) : null, itemCatalogId,
          referenceSource, sortOrder, version,
        ],
      );
      await this.emit(client, tenantId, actor, fieldId, null, 'updated');
      return { id: fieldId, key: row.key, data_type: dataType, label, required, version };
    });
  }

  async deleteField(tenantId: string, fieldId: string, actor: Actor): Promise<{ status: 'ok' }> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `UPDATE attribute_definitions SET is_active = false WHERE id = $1 AND owner_org_id IS NULL`,
        [fieldId],
      );
      if ((res.rowCount ?? 0) === 0) {
        throw new AppException('not_found', { detail: 'Field not found' });
      }
      await this.emit(client, tenantId, actor, fieldId, null, 'deleted');
      return { status: 'ok' };
    });
  }

  async createVertical(tenantId: string, dto: CreateVerticalDto, actor: Actor): Promise<{ id: string; code: string }> {
    return this.db.withTenant(tenantId, async (client) => {
      const id = uuidv7();
      await client.query(
        `INSERT INTO verticals (id, tenant_id, code, name, default_fulfillment, default_tracking, config)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb)`,
        [id, tenantId, dto.code, j(dto.name), dto.default_fulfillment, dto.default_tracking, j(dto.config ?? {})],
      );
      await this.outbox.emit(client, { type: 'catalog.vertical_changed', tenantId, actor, data: { vertical_id: id, action: 'created' } });
      return { id, code: dto.code };
    });
  }

  async updateVertical(tenantId: string, id: string, dto: UpdateVerticalDto, actor: Actor): Promise<{ id: string }> {
    return this.db.withTenant(tenantId, async (client) => {
      const cur = await client.query<{ name: Record<string, string>; default_fulfillment: string; default_tracking: string; config: unknown }>(
        `SELECT name, default_fulfillment, default_tracking, config FROM verticals WHERE id = $1`,
        [id],
      );
      const row = cur.rows[0];
      if (!row) throw new AppException('not_found', { detail: 'Vertical not found' });
      await client.query(
        `UPDATE verticals SET name = $2::jsonb, default_fulfillment = $3, default_tracking = $4, config = $5::jsonb WHERE id = $1`,
        [
          id,
          j(dto.name ?? row.name),
          dto.default_fulfillment ?? row.default_fulfillment,
          dto.default_tracking ?? row.default_tracking,
          j(dto.config ?? row.config),
        ],
      );
      await this.outbox.emit(client, { type: 'catalog.vertical_changed', tenantId, actor, data: { vertical_id: id, action: 'updated' } });
      return { id };
    });
  }

  async createCategory(tenantId: string, verticalId: string, dto: CreateCategoryDto, actor: Actor): Promise<{ id: string; code: string }> {
    return this.db.withTenant(tenantId, async (client) => {
      const v = await client.query(`SELECT 1 FROM verticals WHERE id = $1`, [verticalId]);
      if ((v.rowCount ?? 0) === 0) throw new AppException('not_found', { detail: 'Vertical not found' });
      const id = uuidv7();
      await client.query(
        `INSERT INTO categories (id, tenant_id, vertical_id, parent_id, fulfillment, tracking, code, name, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [id, tenantId, verticalId, dto.parent_id ?? null, dto.fulfillment ?? null, dto.tracking ?? null, dto.code, j(dto.name), dto.sort_order],
      );
      await this.outbox.emit(client, { type: 'catalog.category_changed', tenantId, actor, data: { category_id: id, vertical_id: verticalId, action: 'created' } });
      return { id, code: dto.code };
    });
  }

  async updateCategory(tenantId: string, id: string, dto: UpdateCategoryDto, actor: Actor): Promise<{ id: string }> {
    return this.db.withTenant(tenantId, async (client) => {
      const cur = await client.query<{ name: Record<string, string>; parent_id: string | null; fulfillment: string | null; tracking: string | null; sort_order: number }>(
        `SELECT name, parent_id, fulfillment, tracking, sort_order FROM categories WHERE id = $1`,
        [id],
      );
      const row = cur.rows[0];
      if (!row) throw new AppException('not_found', { detail: 'Category not found' });
      await client.query(
        `UPDATE categories SET name = $2::jsonb, parent_id = $3, fulfillment = $4, tracking = $5, sort_order = $6 WHERE id = $1`,
        [
          id,
          j(dto.name ?? row.name),
          dto.parent_id ?? row.parent_id,
          dto.fulfillment ?? row.fulfillment,
          dto.tracking ?? row.tracking,
          dto.sort_order ?? row.sort_order,
        ],
      );
      await this.outbox.emit(client, { type: 'catalog.category_changed', tenantId, actor, data: { category_id: id, action: 'updated' } });
      return { id };
    });
  }

  private async emit(
    client: Parameters<OutboxService['emit']>[0],
    tenantId: string,
    actor: Actor,
    fieldId: string,
    verticalId: string | null,
    action: string,
  ): Promise<void> {
    await this.outbox.emit(client, {
      type: 'catalog.field_changed',
      tenantId,
      actor,
      data: { field_id: fieldId, ...(verticalId ? { vertical_id: verticalId } : {}), action },
    });
  }
}
