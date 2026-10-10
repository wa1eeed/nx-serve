import { Injectable } from '@nestjs/common';
import { type PoolClient } from '@nxserve/db';
import { uuidv7 } from '@nxserve/domain';
import {
  type CreateFeeScheduleDto,
  type CreateRateCardDto,
  type CreateSurgeScheduleDto,
  type FeeComponentConfigDto,
  type FeeComponentDetail,
  type FeeScheduleDetail,
  type FeeScheduleSummary,
  type PricingApprovalDto,
  type RateCardDetail,
  type RateCardSummary,
  type SurgeScheduleDetail,
  type TranslatableText,
  type UpdateFeeScheduleDto,
  type UpdateRateCardDto,
  type UpdateSurgeScheduleDto,
} from '@nxserve/contracts';
import { DbService } from '../db/db.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { AppException } from '../common/app-exception.js';
import { type Actor } from '../context/request-context.js';

const j = (value: unknown): string => JSON.stringify(value);
/** pg returns timestamptz as a Date; the contract wants an RFC 3339 string. */
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
/** A nullable optional money/number input distinguishes "omit" from "null". */
const given = <T>(v: T | undefined, current: T): T => (v === undefined ? current : v);

/**
 * Admin writes for pricing (docs/09): rate cards and fee schedules use
 * maker-checker (pricing.edit creates and submits a draft; pricing.approve
 * approves it, and the approver can never be the creator); surge schedules are
 * edited under pricing.edit. Money stays in minor-unit strings end to end.
 */
@Injectable()
export class PricingAdminService {
  constructor(
    private readonly db: DbService,
    private readonly outbox: OutboxService,
  ) {}

  // ===================================================================
  // Rate cards
  // ===================================================================

  createRateCard(tenantId: string, dto: CreateRateCardDto, actor: Actor): Promise<RateCardDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      await assertRef(client, 'service_tiers', dto.tier_id, 'Service tier');
      await assertRef(client, 'cities', dto.city_id, 'City');
      if (dto.zone_id) await assertRef(client, 'zones', dto.zone_id, 'Zone');
      if (dto.vehicle_class_id) await assertRef(client, 'vehicle_classes', dto.vehicle_class_id, 'Vehicle class');
      const id = uuidv7();
      const version = await nextVersion(
        client,
        `SELECT COALESCE(MAX(version),0)+1 AS v FROM rate_cards
         WHERE tier_id=$1 AND city_id=$2 AND zone_id IS NOT DISTINCT FROM $3 AND vehicle_class_id IS NOT DISTINCT FROM $4`,
        [dto.tier_id, dto.city_id, dto.zone_id ?? null, dto.vehicle_class_id ?? null],
      );
      await client.query(
        `INSERT INTO rate_cards
           (id, tenant_id, tier_id, city_id, zone_id, vehicle_class_id, currency, base_fare_minor,
            booking_fee_minor, included_km, per_km, approach_per_km, approach_free_km, per_min, free_wait_min,
            per_wait_min, flat_fare_minor, minimum_fare_minor, maximum_fare_minor, class_multiplier,
            extra_stop_fee_minor, auth_buffer_pct, reprice_threshold_pct, rounding, cancellation_fee_minor,
            cancellation_free_min, version, status, valid_from, valid_to, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,'draft',$28,$29,$30)`,
        [
          id, tenantId, dto.tier_id, dto.city_id, dto.zone_id ?? null, dto.vehicle_class_id ?? null, dto.currency,
          dto.base_fare_minor, dto.booking_fee_minor, dto.included_km, dto.per_km, dto.approach_per_km,
          dto.approach_free_km, dto.per_min, dto.free_wait_min, dto.per_wait_min, dto.flat_fare_minor ?? null,
          dto.minimum_fare_minor, dto.maximum_fare_minor ?? null, dto.class_multiplier, dto.extra_stop_fee_minor,
          dto.auth_buffer_pct, dto.reprice_threshold_pct, dto.rounding, dto.cancellation_fee_minor,
          dto.cancellation_free_min, version, dto.valid_from ?? null, dto.valid_to ?? null, actor.id ?? null,
        ],
      );
      await this.emitRateCard(client, tenantId, actor, id, 'created');
      return this.loadRateCard(client, id);
    });
  }

  listRateCards(tenantId: string): Promise<RateCardSummary[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<RateCardRow>(
        `${RATE_CARD_SELECT} ORDER BY tier_id, city_id, version DESC`,
      );
      return res.rows.map(toRateCardSummary);
    });
  }

  getRateCard(tenantId: string, id: string): Promise<RateCardDetail> {
    return this.db.withTenant(tenantId, (client) => this.loadRateCard(client, id));
  }

  updateRateCard(tenantId: string, id: string, dto: UpdateRateCardDto, actor: Actor): Promise<RateCardDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const cur = await this.loadRateCard(client, id);
      assertEditable(cur.status, 'Rate card');
      await client.query(
        `UPDATE rate_cards SET
           tier_id=$2, city_id=$3, zone_id=$4, vehicle_class_id=$5, currency=$6, base_fare_minor=$7,
           booking_fee_minor=$8, included_km=$9, per_km=$10, approach_per_km=$11, approach_free_km=$12,
           per_min=$13, free_wait_min=$14, per_wait_min=$15, flat_fare_minor=$16, minimum_fare_minor=$17,
           maximum_fare_minor=$18, class_multiplier=$19, extra_stop_fee_minor=$20, auth_buffer_pct=$21,
           reprice_threshold_pct=$22, rounding=$23, cancellation_fee_minor=$24, cancellation_free_min=$25,
           valid_from=$26, valid_to=$27
         WHERE id=$1`,
        [
          id, dto.tier_id ?? cur.tier_id, dto.city_id ?? cur.city_id, given(dto.zone_id, cur.zone_id),
          given(dto.vehicle_class_id, cur.vehicle_class_id), dto.currency ?? cur.currency,
          dto.base_fare_minor ?? cur.base_fare_minor, dto.booking_fee_minor ?? cur.booking_fee_minor,
          dto.included_km ?? cur.included_km, dto.per_km ?? cur.per_km, dto.approach_per_km ?? cur.approach_per_km,
          dto.approach_free_km ?? cur.approach_free_km, dto.per_min ?? cur.per_min,
          dto.free_wait_min ?? cur.free_wait_min, dto.per_wait_min ?? cur.per_wait_min,
          given(dto.flat_fare_minor, cur.flat_fare_minor), dto.minimum_fare_minor ?? cur.minimum_fare_minor,
          given(dto.maximum_fare_minor, cur.maximum_fare_minor), dto.class_multiplier ?? cur.class_multiplier,
          dto.extra_stop_fee_minor ?? cur.extra_stop_fee_minor, dto.auth_buffer_pct ?? cur.auth_buffer_pct,
          dto.reprice_threshold_pct ?? cur.reprice_threshold_pct, dto.rounding ?? cur.rounding,
          dto.cancellation_fee_minor ?? cur.cancellation_fee_minor,
          dto.cancellation_free_min ?? cur.cancellation_free_min, given(dto.valid_from, cur.valid_from),
          given(dto.valid_to, cur.valid_to),
        ],
      );
      // Four-eyes: editing a submitted card invalidates the pending approval, so it
      // returns to draft and must be resubmitted and reviewed again.
      if (cur.status === 'pending_approval') {
        await client.query(`UPDATE rate_cards SET status='draft' WHERE id=$1`, [id]);
      }
      await this.emitRateCard(client, tenantId, actor, id, 'updated');
      return this.loadRateCard(client, id);
    });
  }

  submitRateCard(tenantId: string, id: string, actor: Actor): Promise<RateCardDetail> {
    return this.transition(tenantId, 'rate_cards', id, 'draft', 'pending_approval', actor, (c, i) => this.loadRateCard(c, i), 'submitted', 'Rate card');
  }

  rejectRateCard(tenantId: string, id: string, dto: PricingApprovalDto, actor: Actor): Promise<RateCardDetail> {
    return this.transition(tenantId, 'rate_cards', id, 'pending_approval', 'draft', actor, (c, i) => this.loadRateCard(c, i), 'rejected', 'Rate card', dto.notes);
  }

  approveRateCard(tenantId: string, id: string, dto: PricingApprovalDto, actor: Actor): Promise<RateCardDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const cur = await this.fetchRateCard(client, id);
      assertApprovable(cur.status, cur.created_by, actor, 'Rate card');
      // Atomic activate: the status guard turns a concurrent double-approve, or an
      // edit that reverted the card to draft, into a clean 409 rather than a race.
      const upd = await client.query(
        `UPDATE rate_cards SET status='active', approved_by=$2, approved_at=now()
         WHERE id=$1 AND status='pending_approval'`,
        [id, actor.id ?? null],
      );
      if ((upd.rowCount ?? 0) === 0) throw new AppException('conflict', { detail: 'Rate card is no longer pending approval' });
      // One active card per scope: archive any previously active sibling.
      await client.query(
        `UPDATE rate_cards SET status='archived'
         WHERE id <> $1 AND status='active' AND tier_id=$2 AND city_id=$3
           AND zone_id IS NOT DISTINCT FROM $4 AND vehicle_class_id IS NOT DISTINCT FROM $5`,
        [id, cur.tier_id, cur.city_id, cur.zone_id, cur.vehicle_class_id],
      );
      await this.emitRateCard(client, tenantId, actor, id, 'approved', dto.notes);
      return this.loadRateCard(client, id);
    });
  }

  archiveRateCard(tenantId: string, id: string, actor: Actor): Promise<RateCardDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query(`UPDATE rate_cards SET status='archived' WHERE id=$1 AND status <> 'archived'`, [id]);
      // No row changed: the card is missing (loadRateCard 404s) or already archived
      // (idempotent, no duplicate event).
      if ((res.rowCount ?? 0) === 0) return this.loadRateCard(client, id);
      await this.emitRateCard(client, tenantId, actor, id, 'archived');
      return this.loadRateCard(client, id);
    });
  }

  // ===================================================================
  // Fee schedules
  // ===================================================================

  createFeeSchedule(tenantId: string, dto: CreateFeeScheduleDto, actor: Actor): Promise<FeeScheduleDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      if (dto.vertical_id) await assertRef(client, 'verticals', dto.vertical_id, 'Vertical');
      if (dto.category_id) await assertRef(client, 'categories', dto.category_id, 'Category');
      if (dto.city_id) await assertRef(client, 'cities', dto.city_id, 'City');
      if (dto.zone_id) await assertRef(client, 'zones', dto.zone_id, 'Zone');
      if (dto.provider_org_id) await assertRef(client, 'provider_orgs', dto.provider_org_id, 'Provider');
      const id = uuidv7();
      const version = await nextVersion(
        client,
        `SELECT COALESCE(MAX(version),0)+1 AS v FROM fee_schedules
         WHERE vertical_id IS NOT DISTINCT FROM $1 AND category_id IS NOT DISTINCT FROM $2
           AND city_id IS NOT DISTINCT FROM $3 AND zone_id IS NOT DISTINCT FROM $4
           AND provider_org_id IS NOT DISTINCT FROM $5`,
        [dto.vertical_id ?? null, dto.category_id ?? null, dto.city_id ?? null, dto.zone_id ?? null, dto.provider_org_id ?? null],
      );
      await client.query(
        `INSERT INTO fee_schedules
           (id, tenant_id, name, vertical_id, category_id, city_id, zone_id, provider_org_id, currency,
            gateway_fee_bearer, priority, version, status, valid_from, valid_to, created_by)
         VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13,$14,$15)`,
        [
          id, tenantId, j(dto.name), dto.vertical_id ?? null, dto.category_id ?? null, dto.city_id ?? null,
          dto.zone_id ?? null, dto.provider_org_id ?? null, dto.currency, dto.gateway_fee_bearer, dto.priority,
          version, dto.valid_from ?? null, dto.valid_to ?? null, actor.id ?? null,
        ],
      );
      await this.replaceComponents(client, tenantId, id, dto.components);
      await this.emitFeeSchedule(client, tenantId, actor, id, 'created');
      return this.loadFeeSchedule(client, id);
    });
  }

  listFeeSchedules(tenantId: string): Promise<FeeScheduleSummary[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<FeeScheduleRow & { component_count: string }>(
        `${FEE_SCHEDULE_SELECT},
           (SELECT count(*) FROM fee_components fc WHERE fc.schedule_id = fs.id) AS component_count
         FROM fee_schedules fs ORDER BY priority DESC, version DESC`,
      );
      return res.rows.map((r) => ({ ...toFeeScheduleBase(r), component_count: Number(r.component_count) }));
    });
  }

  getFeeSchedule(tenantId: string, id: string): Promise<FeeScheduleDetail> {
    return this.db.withTenant(tenantId, (client) => this.loadFeeSchedule(client, id));
  }

  updateFeeSchedule(tenantId: string, id: string, dto: UpdateFeeScheduleDto, actor: Actor): Promise<FeeScheduleDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const cur = await this.loadFeeSchedule(client, id);
      assertEditable(cur.status, 'Fee schedule');
      await client.query(
        `UPDATE fee_schedules SET
           name=$2::jsonb, vertical_id=$3, category_id=$4, city_id=$5, zone_id=$6, provider_org_id=$7,
           currency=$8, gateway_fee_bearer=$9, priority=$10, valid_from=$11, valid_to=$12
         WHERE id=$1`,
        [
          id, j(dto.name ?? cur.name), given(dto.vertical_id, cur.vertical_id), given(dto.category_id, cur.category_id),
          given(dto.city_id, cur.city_id), given(dto.zone_id, cur.zone_id), given(dto.provider_org_id, cur.provider_org_id),
          dto.currency ?? cur.currency, dto.gateway_fee_bearer ?? cur.gateway_fee_bearer, dto.priority ?? cur.priority,
          given(dto.valid_from, cur.valid_from), given(dto.valid_to, cur.valid_to),
        ],
      );
      if (dto.components !== undefined) await this.replaceComponents(client, tenantId, id, dto.components);
      // Four-eyes: editing a submitted schedule invalidates the pending approval.
      if (cur.status === 'pending_approval') {
        await client.query(`UPDATE fee_schedules SET status='draft' WHERE id=$1`, [id]);
      }
      await this.emitFeeSchedule(client, tenantId, actor, id, 'updated');
      return this.loadFeeSchedule(client, id);
    });
  }

  submitFeeSchedule(tenantId: string, id: string, actor: Actor): Promise<FeeScheduleDetail> {
    return this.transition(tenantId, 'fee_schedules', id, 'draft', 'pending_approval', actor, (c, i) => this.loadFeeSchedule(c, i), 'submitted', 'Fee schedule');
  }

  rejectFeeSchedule(tenantId: string, id: string, dto: PricingApprovalDto, actor: Actor): Promise<FeeScheduleDetail> {
    return this.transition(tenantId, 'fee_schedules', id, 'pending_approval', 'draft', actor, (c, i) => this.loadFeeSchedule(c, i), 'rejected', 'Fee schedule', dto.notes);
  }

  approveFeeSchedule(tenantId: string, id: string, dto: PricingApprovalDto, actor: Actor): Promise<FeeScheduleDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const cur = await this.fetchFeeSchedule(client, id);
      assertApprovable(cur.status, cur.created_by, actor, 'Fee schedule');
      const upd = await client.query(
        `UPDATE fee_schedules SET status='active', approved_by=$2, approved_at=now()
         WHERE id=$1 AND status='pending_approval'`,
        [id, actor.id ?? null],
      );
      if ((upd.rowCount ?? 0) === 0) throw new AppException('conflict', { detail: 'Fee schedule is no longer pending approval' });
      await client.query(
        `UPDATE fee_schedules SET status='archived'
         WHERE id <> $1 AND status='active' AND vertical_id IS NOT DISTINCT FROM $2
           AND category_id IS NOT DISTINCT FROM $3 AND city_id IS NOT DISTINCT FROM $4
           AND zone_id IS NOT DISTINCT FROM $5 AND provider_org_id IS NOT DISTINCT FROM $6`,
        [id, cur.vertical_id, cur.category_id, cur.city_id, cur.zone_id, cur.provider_org_id],
      );
      await this.emitFeeSchedule(client, tenantId, actor, id, 'approved', dto.notes);
      return this.loadFeeSchedule(client, id);
    });
  }

  archiveFeeSchedule(tenantId: string, id: string, actor: Actor): Promise<FeeScheduleDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query(`UPDATE fee_schedules SET status='archived' WHERE id=$1 AND status <> 'archived'`, [id]);
      if ((res.rowCount ?? 0) === 0) return this.loadFeeSchedule(client, id);
      await this.emitFeeSchedule(client, tenantId, actor, id, 'archived');
      return this.loadFeeSchedule(client, id);
    });
  }

  // ===================================================================
  // Surge schedules (configuration)
  // ===================================================================

  createSurgeSchedule(tenantId: string, dto: CreateSurgeScheduleDto, actor: Actor): Promise<SurgeScheduleDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const id = uuidv7();
      await client.query(
        `INSERT INTO surge_schedules
           (id, tenant_id, name, tier_id, city_id, zone_id, days_of_week, time_from, time_to, date_from, date_to, multiplier, is_active)
         VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          id, tenantId, j(dto.name), dto.tier_id ?? null, dto.city_id ?? null, dto.zone_id ?? null,
          dto.days_of_week ?? null, dto.time_from ?? null, dto.time_to ?? null, dto.date_from ?? null,
          dto.date_to ?? null, dto.multiplier, dto.is_active,
        ],
      );
      await this.emitSurge(client, tenantId, actor, id, 'created');
      return this.loadSurge(client, id);
    });
  }

  listSurgeSchedules(tenantId: string): Promise<SurgeScheduleDetail[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<SurgeRow>(`${SURGE_SELECT} ORDER BY id`);
      return res.rows.map(toSurgeDetail);
    });
  }

  updateSurgeSchedule(tenantId: string, id: string, dto: UpdateSurgeScheduleDto, actor: Actor): Promise<SurgeScheduleDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const cur = await this.loadSurge(client, id);
      await client.query(
        `UPDATE surge_schedules SET
           name=$2::jsonb, tier_id=$3, city_id=$4, zone_id=$5, days_of_week=$6, time_from=$7, time_to=$8,
           date_from=$9, date_to=$10, multiplier=$11, is_active=$12
         WHERE id=$1`,
        [
          id, j(dto.name ?? cur.name), given(dto.tier_id, cur.tier_id), given(dto.city_id, cur.city_id),
          given(dto.zone_id, cur.zone_id), given(dto.days_of_week, cur.days_of_week), given(dto.time_from, cur.time_from),
          given(dto.time_to, cur.time_to), given(dto.date_from, cur.date_from), given(dto.date_to, cur.date_to),
          dto.multiplier ?? cur.multiplier, dto.is_active ?? cur.is_active,
        ],
      );
      await this.emitSurge(client, tenantId, actor, id, 'updated');
      return this.loadSurge(client, id);
    });
  }

  deleteSurgeSchedule(tenantId: string, id: string, actor: Actor): Promise<{ status: 'ok' }> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query(`UPDATE surge_schedules SET is_active=false WHERE id=$1`, [id]);
      if ((res.rowCount ?? 0) === 0) throw new AppException('not_found', { detail: 'Surge schedule not found' });
      await this.emitSurge(client, tenantId, actor, id, 'deleted');
      return { status: 'ok' };
    });
  }

  // ===================================================================
  // Internals
  // ===================================================================

  /** A simple status move (submit, reject) with an actor and an emitted event. */
  private async transition<T>(
    tenantId: string,
    table: 'rate_cards' | 'fee_schedules',
    id: string,
    from: string,
    to: string,
    actor: Actor,
    load: (client: PoolClient, id: string) => Promise<T>,
    action: string,
    label: string,
    notes?: string,
  ): Promise<T> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{ status: string }>(`SELECT status FROM ${table} WHERE id=$1`, [id]);
      const row = res.rows[0];
      if (!row) throw new AppException('not_found', { detail: `${label} not found` });
      if (row.status !== from) {
        throw new AppException('conflict', { detail: `${label} must be ${from} to be ${action}, it is ${row.status}` });
      }
      // Guard the write on the expected status so a concurrent transition cannot
      // double-apply (the read above only gives a clearer message for the slow path).
      const upd = await client.query(`UPDATE ${table} SET status=$2 WHERE id=$1 AND status=$3`, [id, to, from]);
      if ((upd.rowCount ?? 0) === 0) {
        throw new AppException('conflict', { detail: `${label} changed state concurrently; reload and retry` });
      }
      const type = table === 'rate_cards' ? 'pricing.rate_card_changed' : 'pricing.fee_schedule_changed';
      await this.outbox.emit(client, {
        type,
        tenantId,
        actor,
        data: { [table === 'rate_cards' ? 'rate_card_id' : 'fee_schedule_id']: id, action, ...(notes ? { notes } : {}) },
      });
      return load(client, id);
    });
  }

  private async replaceComponents(client: PoolClient, tenantId: string, scheduleId: string, components: FeeComponentConfigDto[]): Promise<void> {
    await client.query(`DELETE FROM fee_components WHERE schedule_id=$1`, [scheduleId]);
    for (const [i, c] of components.entries()) {
      await client.query(
        `INSERT INTO fee_components
           (id, tenant_id, schedule_id, code, label, bearer, calc, rate_pct, fixed_amount_minor, min_amount_minor,
            max_amount_minor, base, payment_method, vat_mode, refundable, show_to_customer, sort_order)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          uuidv7(), tenantId, scheduleId, c.code, j(c.label), c.bearer, c.calc, c.rate_pct ?? null,
          c.fixed_amount_minor ?? null, c.min_amount_minor ?? null, c.max_amount_minor ?? null, c.base,
          c.payment_method ?? null, c.vat_mode, c.refundable, c.show_to_customer, c.sort_order ?? i,
        ],
      );
    }
  }

  private async fetchRateCard(client: PoolClient, id: string): Promise<RateCardRow> {
    const res = await client.query<RateCardRow>(`${RATE_CARD_SELECT} WHERE id=$1`, [id]);
    const row = res.rows[0];
    if (!row) throw new AppException('not_found', { detail: 'Rate card not found' });
    return row;
  }

  private async loadRateCard(client: PoolClient, id: string): Promise<RateCardDetail> {
    return toRateCardDetail(await this.fetchRateCard(client, id));
  }

  private async fetchFeeSchedule(client: PoolClient, id: string): Promise<FeeScheduleRow> {
    const res = await client.query<FeeScheduleRow>(`${FEE_SCHEDULE_SELECT} FROM fee_schedules fs WHERE fs.id=$1`, [id]);
    const row = res.rows[0];
    if (!row) throw new AppException('not_found', { detail: 'Fee schedule not found' });
    return row;
  }

  private async loadFeeSchedule(client: PoolClient, id: string): Promise<FeeScheduleDetail> {
    const row = await this.fetchFeeSchedule(client, id);
    const comps = await client.query<FeeComponentRow>(
      `SELECT id, code, label, bearer, calc, rate_pct, fixed_amount_minor, min_amount_minor, max_amount_minor,
              base, payment_method, vat_mode, refundable, show_to_customer, sort_order
       FROM fee_components WHERE schedule_id=$1 ORDER BY sort_order`,
      [id],
    );
    return { ...toFeeScheduleBase(row), components: comps.rows.map(toFeeComponentDetail) };
  }

  private async loadSurge(client: PoolClient, id: string): Promise<SurgeScheduleDetail> {
    const res = await client.query<SurgeRow>(`${SURGE_SELECT} WHERE id=$1`, [id]);
    const row = res.rows[0];
    if (!row) throw new AppException('not_found', { detail: 'Surge schedule not found' });
    return toSurgeDetail(row);
  }

  private async emitRateCard(client: PoolClient, tenantId: string, actor: Actor, id: string, action: string, notes?: string): Promise<void> {
    await this.outbox.emit(client, { type: 'pricing.rate_card_changed', tenantId, actor, data: { rate_card_id: id, action, ...(notes ? { notes } : {}) } });
  }

  private async emitFeeSchedule(client: PoolClient, tenantId: string, actor: Actor, id: string, action: string, notes?: string): Promise<void> {
    await this.outbox.emit(client, { type: 'pricing.fee_schedule_changed', tenantId, actor, data: { fee_schedule_id: id, action, ...(notes ? { notes } : {}) } });
  }

  private async emitSurge(client: PoolClient, tenantId: string, actor: Actor, id: string, action: string): Promise<void> {
    await this.outbox.emit(client, { type: 'pricing.surge_changed', tenantId, actor, data: { surge_schedule_id: id, action } });
  }
}

// --- Guards ---

function assertEditable(status: string, label: string): void {
  if (status !== 'draft' && status !== 'pending_approval') {
    throw new AppException('conflict', { detail: `${label} can only be edited while draft or pending approval` });
  }
}

function assertApprovable(status: string, createdBy: string | null, actor: Actor, label: string): void {
  if (status !== 'pending_approval') {
    throw new AppException('conflict', { detail: `${label} must be pending approval to approve, it is ${status}` });
  }
  // Maker-checker: the approver cannot be the creator (also enforced by a DB CHECK).
  if (createdBy !== null && actor.id !== undefined && createdBy === actor.id) {
    throw new AppException('conflict', { detail: 'The approver cannot be the creator (maker-checker)' });
  }
}

async function assertRef(client: PoolClient, table: string, id: string, label: string): Promise<void> {
  const res = await client.query(`SELECT 1 FROM ${table} WHERE id=$1`, [id]);
  if ((res.rowCount ?? 0) === 0) throw new AppException('not_found', { detail: `${label} not found` });
}

async function nextVersion(client: PoolClient, sql: string, params: unknown[]): Promise<number> {
  const res = await client.query<{ v: string }>(sql, params);
  return Number(res.rows[0]?.v ?? 1);
}

// --- Row shapes and mappers ---

const RATE_CARD_SELECT = `SELECT id, tier_id, city_id, zone_id, vehicle_class_id, currency, base_fare_minor,
  booking_fee_minor, included_km, per_km, approach_per_km, approach_free_km, per_min, free_wait_min, per_wait_min,
  flat_fare_minor, minimum_fare_minor, maximum_fare_minor, class_multiplier, extra_stop_fee_minor, auth_buffer_pct,
  reprice_threshold_pct, rounding, cancellation_fee_minor, cancellation_free_min, status, version, valid_from,
  valid_to, created_by, approved_by, approved_at FROM rate_cards`;

interface RateCardRow {
  id: string;
  tier_id: string;
  city_id: string;
  zone_id: string | null;
  vehicle_class_id: string | null;
  currency: string;
  base_fare_minor: string;
  booking_fee_minor: string;
  included_km: string;
  per_km: string;
  approach_per_km: string;
  approach_free_km: string;
  per_min: string;
  free_wait_min: number;
  per_wait_min: string;
  flat_fare_minor: string | null;
  minimum_fare_minor: string;
  maximum_fare_minor: string | null;
  class_multiplier: string;
  extra_stop_fee_minor: string;
  auth_buffer_pct: string;
  reprice_threshold_pct: string;
  rounding: RateCardDetail['rounding'];
  cancellation_fee_minor: string;
  cancellation_free_min: number;
  status: RateCardDetail['status'];
  version: number;
  valid_from: Date | null;
  valid_to: Date | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: Date | null;
}

function toRateCardDetail(r: RateCardRow): RateCardDetail {
  return {
    id: r.id,
    tier_id: r.tier_id,
    city_id: r.city_id,
    zone_id: r.zone_id,
    vehicle_class_id: r.vehicle_class_id,
    currency: r.currency,
    base_fare_minor: r.base_fare_minor,
    booking_fee_minor: r.booking_fee_minor,
    included_km: Number(r.included_km),
    per_km: Number(r.per_km),
    approach_per_km: Number(r.approach_per_km),
    approach_free_km: Number(r.approach_free_km),
    per_min: Number(r.per_min),
    free_wait_min: Number(r.free_wait_min),
    per_wait_min: Number(r.per_wait_min),
    flat_fare_minor: r.flat_fare_minor,
    minimum_fare_minor: r.minimum_fare_minor,
    maximum_fare_minor: r.maximum_fare_minor,
    class_multiplier: Number(r.class_multiplier),
    extra_stop_fee_minor: r.extra_stop_fee_minor,
    auth_buffer_pct: Number(r.auth_buffer_pct),
    reprice_threshold_pct: Number(r.reprice_threshold_pct),
    rounding: r.rounding,
    cancellation_fee_minor: r.cancellation_fee_minor,
    cancellation_free_min: Number(r.cancellation_free_min),
    status: r.status,
    version: Number(r.version),
    valid_from: iso(r.valid_from),
    valid_to: iso(r.valid_to),
    created_by: r.created_by,
    approved_by: r.approved_by,
    approved_at: iso(r.approved_at),
  };
}

function toRateCardSummary(r: RateCardRow): RateCardSummary {
  return {
    id: r.id,
    tier_id: r.tier_id,
    city_id: r.city_id,
    zone_id: r.zone_id,
    vehicle_class_id: r.vehicle_class_id,
    currency: r.currency,
    base_fare_minor: r.base_fare_minor,
    flat_fare_minor: r.flat_fare_minor,
    minimum_fare_minor: r.minimum_fare_minor,
    status: r.status,
    version: Number(r.version),
    valid_from: iso(r.valid_from),
    valid_to: iso(r.valid_to),
    created_by: r.created_by,
    approved_by: r.approved_by,
  };
}

const FEE_SCHEDULE_SELECT = `SELECT fs.id, fs.name, fs.vertical_id, fs.category_id, fs.city_id, fs.zone_id,
  fs.provider_org_id, fs.currency, fs.gateway_fee_bearer, fs.priority, fs.status, fs.version, fs.valid_from,
  fs.valid_to, fs.created_by, fs.approved_by, fs.approved_at`;

interface FeeScheduleRow {
  id: string;
  name: TranslatableText;
  vertical_id: string | null;
  category_id: string | null;
  city_id: string | null;
  zone_id: string | null;
  provider_org_id: string | null;
  currency: string;
  gateway_fee_bearer: FeeScheduleDetail['gateway_fee_bearer'];
  priority: number;
  status: FeeScheduleDetail['status'];
  version: number;
  valid_from: Date | null;
  valid_to: Date | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: Date | null;
}

function toFeeScheduleBase(r: FeeScheduleRow): Omit<FeeScheduleDetail, 'components'> {
  return {
    id: r.id,
    name: r.name,
    vertical_id: r.vertical_id,
    category_id: r.category_id,
    city_id: r.city_id,
    zone_id: r.zone_id,
    provider_org_id: r.provider_org_id,
    currency: r.currency,
    gateway_fee_bearer: r.gateway_fee_bearer,
    priority: Number(r.priority),
    status: r.status,
    version: Number(r.version),
    valid_from: iso(r.valid_from),
    valid_to: iso(r.valid_to),
    created_by: r.created_by,
    approved_by: r.approved_by,
    approved_at: iso(r.approved_at),
  };
}

interface FeeComponentRow {
  id: string;
  code: string;
  label: TranslatableText;
  bearer: FeeComponentDetail['bearer'];
  calc: FeeComponentDetail['calc'];
  rate_pct: string | null;
  fixed_amount_minor: string | null;
  min_amount_minor: string | null;
  max_amount_minor: string | null;
  base: FeeComponentDetail['base'];
  payment_method: string | null;
  vat_mode: FeeComponentDetail['vat_mode'];
  refundable: boolean;
  show_to_customer: boolean;
  sort_order: number;
}

function toFeeComponentDetail(r: FeeComponentRow): FeeComponentDetail {
  return {
    id: r.id,
    code: r.code,
    label: r.label,
    bearer: r.bearer,
    calc: r.calc,
    rate_pct: r.rate_pct === null ? null : Number(r.rate_pct),
    fixed_amount_minor: r.fixed_amount_minor,
    min_amount_minor: r.min_amount_minor,
    max_amount_minor: r.max_amount_minor,
    base: r.base,
    payment_method: r.payment_method,
    vat_mode: r.vat_mode,
    refundable: r.refundable,
    show_to_customer: r.show_to_customer,
    sort_order: Number(r.sort_order),
  };
}

const SURGE_SELECT = `SELECT id, name, tier_id, city_id, zone_id, days_of_week,
  to_char(time_from, 'HH24:MI:SS') AS time_from, to_char(time_to, 'HH24:MI:SS') AS time_to,
  to_char(date_from, 'YYYY-MM-DD') AS date_from, to_char(date_to, 'YYYY-MM-DD') AS date_to,
  multiplier, is_active FROM surge_schedules`;

interface SurgeRow {
  id: string;
  name: TranslatableText;
  tier_id: string | null;
  city_id: string | null;
  zone_id: string | null;
  days_of_week: number[] | null;
  time_from: string | null;
  time_to: string | null;
  date_from: string | null;
  date_to: string | null;
  multiplier: string;
  is_active: boolean;
}

function toSurgeDetail(r: SurgeRow): SurgeScheduleDetail {
  return {
    id: r.id,
    name: r.name,
    tier_id: r.tier_id,
    city_id: r.city_id,
    zone_id: r.zone_id,
    days_of_week: r.days_of_week,
    time_from: r.time_from,
    time_to: r.time_to,
    date_from: r.date_from,
    date_to: r.date_to,
    multiplier: Number(r.multiplier),
    is_active: r.is_active,
  };
}
