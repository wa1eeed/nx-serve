import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type PoolClient } from '@nxserve/db';
import {
  type CoreStatus,
  type PaymentAction,
  type ProofProvided,
  type Stage,
  type StageActor,
  type Transition,
  advanceWorkflow,
  isTerminalStatus,
  stageByCode,
  startWorkflow,
  uuidv7,
} from '@nxserve/domain';
import { type AdvanceStageDto, type AssignOrderDto, type CreateOrderDto, type OrderDetail, type StageResult } from '@nxserve/contracts';
import { DbService } from '../db/db.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { AppException } from '../common/app-exception.js';
import { type Actor } from '../context/request-context.js';

const j = (value: unknown): string => JSON.stringify(value);

interface EstimateRow {
  vertical_id: string | null;
  category_id: string | null;
  tier_id: string | null;
  city_id: string | null;
  zone_id: string | null;
  vehicle_class_id: string | null;
  currency: string;
  customer_total_minor: string;
  rate_card_id: string | null;
  expires_at: Date;
}

/** Orders (docs/07): create from a stored estimate, and read. The order is created
 * ready to dispatch; the workflow state machine runs on assignment (a later increment). */
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DbService,
    private readonly outbox: OutboxService,
  ) {}

  createOrder(tenantId: string, actor: Actor, dto: CreateOrderDto): Promise<OrderDetail> {
    if (actor.type !== 'customer' || !actor.id) {
      throw new AppException('forbidden', { detail: 'A customer must place the order' });
    }
    const customerId = actor.id;
    if (!dto.terms_accepted) throw new AppException('validation_error', { detail: 'Terms must be accepted' });

    return this.db.withTenant(tenantId, async (client) => {
      const est = await loadEstimate(client, dto.estimate_id);
      if (new Date(est.expires_at).getTime() <= Date.now()) {
        throw new AppException('conflict', { detail: 'The estimate has expired; request a new one' });
      }
      if (!est.vertical_id) throw new AppException('conflict', { detail: 'The estimate has no vertical to create an order for' });

      const vertical = await loadVertical(client, est.vertical_id);
      const snapshot = await loadCancellationSnapshot(client, est.rate_card_id);

      const id = uuidv7();
      const reference = orderReference();
      const windowStart = dto.timing_type !== 'now' ? (dto.window_start ?? null) : null;
      const windowEnd = dto.timing_type !== 'now' ? (dto.window_end ?? null) : null;

      await client.query(
        `INSERT INTO orders
           (id, tenant_id, reference, customer_id, vertical_id, category_id, city_id, zone_id, tier_id,
            vehicle_class_id, fulfillment, tracking, timing_type, window_start, window_end, onsite_contact,
            customer_notes, terms_accepted_at, attributes, price_estimate_id, estimated_amount_minor, currency,
            status, workflow_id, pricing_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,now(),$18::jsonb,$19,$20,$21,
                 'dispatching',$22,$23::jsonb)`,
        [
          id, tenantId, reference, customerId, est.vertical_id, est.category_id, est.city_id, est.zone_id, est.tier_id,
          est.vehicle_class_id, vertical.default_fulfillment, vertical.default_tracking, dto.timing_type, windowStart,
          windowEnd, dto.onsite_contact ? j(dto.onsite_contact) : null, dto.customer_notes ?? null, j(dto.attributes),
          dto.estimate_id, est.customer_total_minor, est.currency, vertical.workflow_id, j(snapshot),
        ],
      );

      for (const [i, s] of dto.stops.entries()) {
        await client.query(
          `INSERT INTO order_stops (id, tenant_id, order_id, sequence, kind, location, address, contact, instructions)
           VALUES ($1,$2,$3,$4,$5, ST_SetSRID(ST_MakePoint($7,$6),4326)::geography, $8::jsonb, $9::jsonb, $10)`,
          [
            uuidv7(), tenantId, id, i, s.kind, s.lat, s.lng, s.address ? j(s.address) : null,
            s.contact ? j(s.contact) : null, s.instructions ?? null,
          ],
        );
      }

      await recordEvent(client, tenantId, id, null, 'dispatching', actor);
      await this.outbox.emit(client, {
        type: 'order.created',
        tenantId,
        actor,
        data: { order_id: id, reference, vertical_id: est.vertical_id, status: 'dispatching' },
      });

      return this.detailOf(client, await this.fetchOrder(client, id));
    });
  }

  getOrder(tenantId: string, orderId: string, actor: Actor): Promise<OrderDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const row = await this.fetchOrder(client, orderId);
      // Owner-only: this customer route never serves an anonymous, system, agent or
      // staff caller (any of which would otherwise read every order's location and
      // amount). Staff and the assigned agent get their own permission-guarded routes.
      // 404 rather than 403 so existence is not leaked.
      if (actor.type !== 'customer' || !actor.id || row.customer_id !== actor.id) {
        throw new AppException('not_found', { detail: 'Order not found' });
      }
      return this.detailOf(client, row);
    });
  }

  /** A staff read of any order in the tenant (permission-guarded at the controller). */
  getOrderForStaff(tenantId: string, orderId: string): Promise<OrderDetail> {
    return this.db.withTenant(tenantId, async (client) => this.detailOf(client, await this.fetchOrder(client, orderId)));
  }

  /** Manually assign a provider, which starts the workflow (ops; manual dispatch). */
  assignOrder(tenantId: string, orderId: string, dto: AssignOrderDto, actor: Actor): Promise<StageResult> {
    return this.db.withTenant(tenantId, async (client) => {
      const order = await this.fetchOrder(client, orderId);
      if (order.status !== 'dispatching') {
        throw new AppException('conflict', { detail: `Order is ${order.status}, not awaiting dispatch` });
      }
      if (!order.workflow_id) throw new AppException('conflict', { detail: 'Order has no workflow to start' });
      await assertRef(client, 'provider_orgs', dto.org_id, 'Provider');
      const agent = await client.query<{ org_id: string }>(`SELECT org_id FROM provider_agents WHERE id = $1`, [dto.agent_id]);
      if (!agent.rows[0]) throw new AppException('not_found', { detail: 'Agent not found' });
      if (agent.rows[0].org_id !== dto.org_id) throw new AppException('conflict', { detail: 'Agent does not belong to that provider' });
      if (dto.asset_id) await assertRef(client, 'assets', dto.asset_id, 'Asset');

      const stages = await loadStages(client, order.workflow_id);
      const t = startWorkflow(stages);
      // Authoritative, status-guarded write: a concurrent second assign matches 0 rows
      // (the row is already 'assigned') and must 409, never emit a duplicate authorize.
      const upd = await client.query(
        `UPDATE orders SET assigned_org_id=$2, assigned_agent_id=$3, asset_id=$4, status=$5, current_stage_code=$6, updated_at=now()
         WHERE id=$1 AND status='dispatching'`,
        [orderId, dto.org_id, dto.agent_id, dto.asset_id ?? null, t.toStatus, t.toCode],
      );
      if ((upd.rowCount ?? 0) === 0) throw new AppException('conflict', { detail: 'Order is no longer awaiting dispatch' });
      await recordEvent(client, tenantId, orderId, order.status, t.toStatus, actor, { to_stage: t.toCode, payment_action: t.sideEffects.paymentAction });
      await this.outbox.emit(client, {
        type: 'order.assigned',
        tenantId,
        actor,
        data: { order_id: orderId, org_id: dto.org_id, agent_id: dto.agent_id, stage: t.toCode, status: t.toStatus, payment_action: t.sideEffects.paymentAction },
      });
      return stageResult(orderId, t, stages);
    });
  }

  /** Advance the current stage after proof (the assigned agent, or the owning customer). */
  advanceStage(tenantId: string, orderId: string, dto: AdvanceStageDto, actor: Actor): Promise<StageResult> {
    return this.db.withTenant(tenantId, async (client) => {
      const order = await this.fetchOrder(client, orderId);
      if (actor.type === 'agent' && order.assigned_agent_id !== actor.id) {
        throw new AppException('forbidden', { detail: 'Only the assigned agent can advance this order' });
      }
      if (actor.type === 'customer' && order.customer_id !== actor.id) {
        throw new AppException('forbidden', { detail: 'Only the customer can advance this order' });
      }
      if (actor.type !== 'agent' && actor.type !== 'customer') {
        throw new AppException('forbidden', { detail: 'Only the agent or customer advances a stage; ops uses the force endpoint' });
      }
      if (!order.current_stage_code || !order.workflow_id) {
        throw new AppException('conflict', { detail: 'Order has no active workflow stage' });
      }
      if (isTerminalStatus(order.status)) {
        throw new AppException('conflict', { detail: `Order is ${order.status} and cannot be advanced` });
      }

      const stages = await loadStages(client, order.workflow_id);
      const cur = stageByCode(stages, order.current_stage_code);
      const otpValid = cur?.requires.otp === true && dto.proof.otp ? await verifyOtp(client, orderId, dto.proof.otp) : false;
      const proof: ProofProvided = {
        ...(dto.proof.photos !== undefined ? { photos: dto.proof.photos } : {}),
        ...(dto.proof.signature !== undefined ? { signature: dto.proof.signature } : {}),
        ...(dto.proof.checklist !== undefined ? { checklist: dto.proof.checklist } : {}),
        otpValid,
      };

      // advanceWorkflow throws a WorkflowError (proof, actor, state) -> 422 via the filter.
      const t = advanceWorkflow({ stages, fromCode: order.current_stage_code, actor: actor.type as StageActor, proof });
      // Optimistic lock on the stage: a concurrent or stale advance matches 0 rows and
      // 409s, so one logical transition can never emit two stage_changed (double capture).
      const upd = await client.query(
        `UPDATE orders SET status=$2, current_stage_code=$3, updated_at=now() WHERE id=$1 AND current_stage_code=$4`,
        [orderId, t.toStatus, t.toCode, order.current_stage_code],
      );
      if ((upd.rowCount ?? 0) === 0) throw new AppException('conflict', { detail: 'The order stage changed concurrently; reload and retry' });
      await recordEvent(client, tenantId, orderId, order.status, t.toStatus, actor, { from_stage: t.fromCode, to_stage: t.toCode, payment_action: t.sideEffects.paymentAction });
      await this.outbox.emit(client, {
        type: 'order.stage_changed',
        tenantId,
        actor,
        data: { order_id: orderId, from_stage: t.fromCode, stage: t.toCode, status: t.toStatus, payment_action: t.sideEffects.paymentAction },
      });
      return stageResult(orderId, t, stages);
    });
  }

  private async fetchOrder(client: PoolClient, id: string): Promise<OrderRow> {
    const res = await client.query<OrderRow>(`${ORDER_SELECT} WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) throw new AppException('not_found', { detail: 'Order not found' });
    return row;
  }

  private async detailOf(client: PoolClient, row: OrderRow): Promise<OrderDetail> {
    const stops = await client.query<StopRow>(
      `SELECT id, sequence, kind, status,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, instructions
       FROM order_stops WHERE order_id = $1 ORDER BY sequence`,
      [row.id],
    );
    return toOrderDetail(row, stops.rows);
  }
}

// --- Loaders ---

async function loadEstimate(client: PoolClient, id: string): Promise<EstimateRow> {
  const res = await client.query<EstimateRow>(
    `SELECT vertical_id, category_id, tier_id, city_id, zone_id, vehicle_class_id, currency,
            customer_total_minor, rate_card_id, expires_at
     FROM price_estimates WHERE id = $1`,
    [id],
  );
  const row = res.rows[0];
  if (!row) throw new AppException('not_found', { detail: 'Estimate not found' });
  return row;
}

interface VerticalRow {
  workflow_id: string | null;
  default_fulfillment: string;
  default_tracking: string;
}
async function loadVertical(client: PoolClient, id: string): Promise<VerticalRow> {
  const res = await client.query<VerticalRow>(
    `SELECT workflow_id, default_fulfillment, default_tracking FROM verticals WHERE id = $1`,
    [id],
  );
  const row = res.rows[0];
  if (!row) throw new AppException('conflict', { detail: 'The estimate vertical no longer exists' });
  return row;
}

interface CancellationSnapshot {
  cancellation_fee_minor: string;
  minimum_fare_minor: string;
  cancellation_free_min: number;
}
/** Snapshot the cancellation policy on the order so a later cancel does not depend on
 * the rate card. A rate card id identifies a specific version (each version is a
 * distinct row) and archiving only changes its status, so the row still resolves and
 * the snapshot is version-stable. The zero fallback is only for an estimate that
 * carried no rate card, which a real estimate never does. */
async function loadCancellationSnapshot(client: PoolClient, rateCardId: string | null): Promise<CancellationSnapshot> {
  const fallback: CancellationSnapshot = { cancellation_fee_minor: '0', minimum_fare_minor: '0', cancellation_free_min: 2 };
  if (!rateCardId) return fallback;
  const res = await client.query<CancellationSnapshot>(
    `SELECT cancellation_fee_minor, minimum_fare_minor, cancellation_free_min FROM rate_cards WHERE id = $1`,
    [rateCardId],
  );
  return res.rows[0] ?? fallback;
}

async function recordEvent(
  client: PoolClient,
  tenantId: string,
  orderId: string,
  from: string | null,
  to: string,
  actor: Actor,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await client.query(
    `INSERT INTO order_events (id, tenant_id, order_id, from_status, to_status, actor_type, actor_id, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [uuidv7(), tenantId, orderId, from, to, eventActorType(actor), actor.id ?? null, j(payload)],
  );
}

/** Maps the request actor to the order_events.actor_type CHECK (customer, agent, ops, system). */
function eventActorType(actor: Actor): string {
  switch (actor.type) {
    case 'staff':
      return 'ops';
    case 'api_client':
      return 'system';
    default:
      return actor.type; // customer, agent, system
  }
}

/** A human-readable, tenant-unique order reference. A large crypto-random suffix
 * makes a same-millisecond, same-tenant collision negligible. */
function orderReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(5).toString('hex').toUpperCase();
  return `NX-${stamp}-${rand}`;
}

async function assertRef(client: PoolClient, table: 'provider_orgs' | 'assets', id: string, label: string): Promise<void> {
  const res = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  if ((res.rowCount ?? 0) === 0) throw new AppException('not_found', { detail: `${label} not found` });
}

/** True if the OTP matches the stored hash of any stop on the order. No stop has an
 * otp_hash until OTP generation ships (a later increment), so today this always fails
 * closed. When OTP generation lands this must be scoped to the stop the current stage
 * concerns (not any stop) and add per-order attempt throttling (see docs/17). */
async function verifyOtp(client: PoolClient, orderId: string, otp: string): Promise<boolean> {
  const hash = createHash('sha256').update(otp).digest('hex');
  const res = await client.query(`SELECT 1 FROM order_stops WHERE order_id = $1 AND otp_hash = $2`, [orderId, hash]);
  return (res.rowCount ?? 0) > 0;
}

interface StageRow {
  code: string;
  maps_to: CoreStatus;
  sort_order: number;
  actor: StageActor;
  tracking_active: boolean;
  requires: Record<string, unknown> | null;
  payment_action: PaymentAction;
  sla_minutes: number | null;
}

/** Loads a workflow's stages and maps them to the engine shape (requires jsonb is
 * snake_case, e.g. photos_min, and becomes the engine's StageRequirements). */
async function loadStages(client: PoolClient, workflowId: string): Promise<Stage[]> {
  const res = await client.query<StageRow>(
    `SELECT code, maps_to, sort_order, actor, tracking_active, requires, payment_action, sla_minutes
     FROM workflow_stages WHERE workflow_id = $1 ORDER BY sort_order`,
    [workflowId],
  );
  return res.rows.map((r) => {
    const req = r.requires ?? {};
    return {
      code: r.code,
      mapsTo: r.maps_to,
      sortOrder: Number(r.sort_order),
      actor: r.actor,
      trackingActive: r.tracking_active,
      requires: {
        // Coerce photos_min so a mis-typed value (e.g. "2") cannot silently disable the gate.
        ...(Number.isFinite(Number(req['photos_min'])) && Number(req['photos_min']) > 0 ? { photosMin: Number(req['photos_min']) } : {}),
        ...(req['otp'] === true ? { otp: true } : {}),
        ...(req['signature'] === true ? { signature: true } : {}),
        ...(Array.isArray(req['checklist']) ? { checklist: req['checklist'] as string[] } : {}),
      },
      paymentAction: r.payment_action,
      slaMinutes: r.sla_minutes,
    };
  });
}

/** Builds the API stage result from a transition, with the now-current stage's tracking. */
function stageResult(orderId: string, t: Transition, stages: readonly Stage[]): StageResult {
  return {
    order_id: orderId,
    status: t.toStatus,
    current_stage_code: t.toCode,
    payment_action: t.sideEffects.paymentAction,
    tracking_active: stageByCode(stages, t.toCode)?.trackingActive ?? false,
  };
}

// --- Row shapes and mapping ---

const ORDER_SELECT = `SELECT id, reference, status, current_stage_code, customer_id, vertical_id, category_id,
  tier_id, city_id, currency, estimated_amount_minor, final_amount_minor, assigned_org_id, assigned_agent_id,
  workflow_id, timing_type, created_at FROM orders`;

interface OrderRow {
  id: string;
  reference: string;
  status: OrderDetail['status'];
  current_stage_code: string | null;
  customer_id: string;
  workflow_id: string | null;
  vertical_id: string;
  category_id: string | null;
  tier_id: string | null;
  city_id: string | null;
  currency: string;
  estimated_amount_minor: string | null;
  final_amount_minor: string | null;
  assigned_org_id: string | null;
  assigned_agent_id: string | null;
  timing_type: string;
  created_at: Date;
}

interface StopRow {
  id: string;
  sequence: number;
  kind: string;
  status: string;
  lat: number | null;
  lng: number | null;
  instructions: string | null;
}

function toOrderDetail(r: OrderRow, stops: StopRow[]): OrderDetail {
  return {
    id: r.id,
    reference: r.reference,
    status: r.status,
    current_stage_code: r.current_stage_code,
    vertical_id: r.vertical_id,
    category_id: r.category_id,
    tier_id: r.tier_id,
    city_id: r.city_id,
    currency: r.currency,
    estimated_amount_minor: r.estimated_amount_minor,
    // Set when a payment authorizes and when the order completes (later increments).
    authorized_minor: null,
    final_amount_minor: r.final_amount_minor,
    assigned_org_id: r.assigned_org_id,
    assigned_agent_id: r.assigned_agent_id,
    timing_type: r.timing_type,
    created_at: r.created_at.toISOString(),
    stops: stops.map((s) => ({
      id: s.id,
      sequence: Number(s.sequence),
      kind: s.kind,
      status: s.status,
      lat: s.lat === null ? null : Number(s.lat),
      lng: s.lng === null ? null : Number(s.lng),
      instructions: s.instructions,
    })),
  };
}
