import { Injectable } from '@nestjs/common';
import { type PoolClient } from '@nxserve/db';
import { uuidv7 } from '@nxserve/domain';
import {
  type CreateStageDto,
  type CreateWorkflowDto,
  type StageDetail,
  type UpdateStageDto,
  type UpdateWorkflowDto,
  type WorkflowDetail,
} from '@nxserve/contracts';
import { DbService } from '../db/db.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { AppException } from '../common/app-exception.js';
import { type Actor } from '../context/request-context.js';

interface StageRow {
  id: string;
  workflow_id: string;
  code: string;
  label: Record<string, string>;
  maps_to: StageDetail['maps_to'];
  sort_order: number;
  actor: StageDetail['actor'];
  tracking_active: boolean;
  requires: Record<string, unknown>;
  payment_action: StageDetail['payment_action'];
  notify: Record<string, unknown>;
  sla_minutes: number | null;
}

const STAGE_COLUMNS = `id, workflow_id, code, label, maps_to, sort_order, actor, tracking_active,
  requires, payment_action, notify, sla_minutes`;

const j = (value: unknown): string => JSON.stringify(value);

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503';
}

/** Admin writes for the order workflow and its stages (docs/07, docs/25). */
@Injectable()
export class WorkflowAdminService {
  constructor(
    private readonly db: DbService,
    private readonly outbox: OutboxService,
  ) {}

  /** The workflow bound to a vertical plus its ordered stages (404 if none yet). */
  async getForVertical(tenantId: string, verticalId: string): Promise<WorkflowDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const v = await client.query<{ workflow_id: string | null }>(
        `SELECT workflow_id FROM verticals WHERE id = $1`,
        [verticalId],
      );
      const vertical = v.rows[0];
      if (!vertical) throw new AppException('not_found', { detail: 'Vertical not found' });
      if (!vertical.workflow_id) throw new AppException('not_found', { detail: 'No workflow for this vertical' });

      const wf = await client.query<{ id: string; name: WorkflowDetail['name']; version: number; is_active: boolean }>(
        `SELECT id, name, version, is_active FROM workflow_definitions WHERE id = $1`,
        [vertical.workflow_id],
      );
      const workflow = wf.rows[0];
      if (!workflow) throw new AppException('not_found', { detail: 'Workflow not found' });

      const stages = await client.query<StageRow>(
        `SELECT ${STAGE_COLUMNS} FROM workflow_stages WHERE workflow_id = $1 ORDER BY sort_order`,
        [workflow.id],
      );
      return { ...workflow, stages: stages.rows.map(toStageDetail) };
    });
  }

  /** Creates a workflow for a vertical that has none and links it. */
  async createForVertical(
    tenantId: string,
    verticalId: string,
    dto: CreateWorkflowDto,
    actor: Actor,
  ): Promise<{ id: string }> {
    return this.db.withTenant(tenantId, async (client) => {
      const v = await client.query<{ workflow_id: string | null }>(
        `SELECT workflow_id FROM verticals WHERE id = $1`,
        [verticalId],
      );
      const vertical = v.rows[0];
      if (!vertical) throw new AppException('not_found', { detail: 'Vertical not found' });
      if (vertical.workflow_id) throw new AppException('conflict', { detail: 'Vertical already has a workflow' });

      const id = uuidv7();
      await client.query(
        `INSERT INTO workflow_definitions (id, tenant_id, name) VALUES ($1, $2, $3::jsonb)`,
        [id, tenantId, j(dto.name)],
      );
      await client.query(`UPDATE verticals SET workflow_id = $2 WHERE id = $1`, [verticalId, id]);
      await this.emitWorkflow(client, tenantId, actor, id, verticalId, 'created');
      return { id };
    });
  }

  async updateWorkflow(tenantId: string, id: string, dto: UpdateWorkflowDto, actor: Actor): Promise<{ id: string }> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query(`UPDATE workflow_definitions SET name = $2::jsonb WHERE id = $1`, [id, j(dto.name)]);
      if ((res.rowCount ?? 0) === 0) throw new AppException('not_found', { detail: 'Workflow not found' });
      await this.emitWorkflow(client, tenantId, actor, id, null, 'updated');
      return { id };
    });
  }

  async createStage(tenantId: string, workflowId: string, dto: CreateStageDto, actor: Actor): Promise<StageDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const wf = await client.query(`SELECT 1 FROM workflow_definitions WHERE id = $1`, [workflowId]);
      if ((wf.rowCount ?? 0) === 0) throw new AppException('not_found', { detail: 'Workflow not found' });
      const id = uuidv7();
      await client.query(
        `INSERT INTO workflow_stages
           (id, tenant_id, workflow_id, code, label, maps_to, sort_order, actor, tracking_active, requires,
            payment_action, notify, sla_minutes)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13)`,
        [
          id, tenantId, workflowId, dto.code, j(dto.label), dto.maps_to, dto.sort_order, dto.actor,
          dto.tracking_active, j(dto.requires), dto.payment_action, j(dto.notify), dto.sla_minutes ?? null,
        ],
      );
      await this.emitStage(client, tenantId, actor, id, workflowId, 'created');
      return loadStage(client, id);
    });
  }

  async updateStage(tenantId: string, stageId: string, dto: UpdateStageDto, actor: Actor): Promise<StageDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const cur = await client.query<StageRow>(
        `SELECT ${STAGE_COLUMNS} FROM workflow_stages WHERE id = $1`,
        [stageId],
      );
      const row = cur.rows[0];
      if (!row) throw new AppException('not_found', { detail: 'Stage not found' });
      const next = {
        label: dto.label ?? row.label,
        maps_to: dto.maps_to ?? row.maps_to,
        sort_order: dto.sort_order ?? row.sort_order,
        actor: dto.actor ?? row.actor,
        tracking_active: dto.tracking_active ?? row.tracking_active,
        requires: dto.requires ?? row.requires,
        payment_action: dto.payment_action ?? row.payment_action,
        notify: dto.notify ?? row.notify,
        sla_minutes: dto.sla_minutes !== undefined ? dto.sla_minutes : row.sla_minutes,
      };
      await client.query(
        `UPDATE workflow_stages SET
           label=$2::jsonb, maps_to=$3, sort_order=$4, actor=$5, tracking_active=$6, requires=$7::jsonb,
           payment_action=$8, notify=$9::jsonb, sla_minutes=$10
         WHERE id=$1`,
        [
          stageId, j(next.label), next.maps_to, next.sort_order, next.actor, next.tracking_active,
          j(next.requires), next.payment_action, j(next.notify), next.sla_minutes ?? null,
        ],
      );
      await this.emitStage(client, tenantId, actor, stageId, row.workflow_id, 'updated');
      return loadStage(client, stageId);
    });
  }

  async deleteStage(tenantId: string, stageId: string, actor: Actor): Promise<{ status: 'ok' }> {
    return this.db.withTenant(tenantId, async (client) => {
      const cur = await client.query<{ workflow_id: string }>(
        `SELECT workflow_id FROM workflow_stages WHERE id = $1`,
        [stageId],
      );
      const row = cur.rows[0];
      if (!row) throw new AppException('not_found', { detail: 'Stage not found' });
      try {
        await client.query(`DELETE FROM workflow_stages WHERE id = $1`, [stageId]);
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new AppException('conflict', { detail: 'Stage is referenced by existing orders' });
        }
        throw error;
      }
      await this.emitStage(client, tenantId, actor, stageId, row.workflow_id, 'deleted');
      return { status: 'ok' };
    });
  }

  /** Sets sort_order to the given stage order (1-based), within one workflow. */
  async reorderStages(tenantId: string, workflowId: string, order: string[], actor: Actor): Promise<{ status: 'ok' }> {
    return this.db.withTenant(tenantId, async (client) => {
      const wf = await client.query(`SELECT 1 FROM workflow_definitions WHERE id = $1`, [workflowId]);
      if ((wf.rowCount ?? 0) === 0) throw new AppException('not_found', { detail: 'Workflow not found' });
      for (let i = 0; i < order.length; i++) {
        await client.query(`UPDATE workflow_stages SET sort_order = $3 WHERE id = $1 AND workflow_id = $2`, [
          order[i],
          workflowId,
          i + 1,
        ]);
      }
      await this.emitWorkflow(client, tenantId, actor, workflowId, null, 'reordered');
      return { status: 'ok' };
    });
  }

  private async emitWorkflow(
    client: Parameters<OutboxService['emit']>[0],
    tenantId: string,
    actor: Actor,
    workflowId: string,
    verticalId: string | null,
    action: string,
  ): Promise<void> {
    await this.outbox.emit(client, {
      type: 'catalog.workflow_changed',
      tenantId,
      actor,
      data: { workflow_id: workflowId, ...(verticalId ? { vertical_id: verticalId } : {}), action },
    });
  }

  private async emitStage(
    client: Parameters<OutboxService['emit']>[0],
    tenantId: string,
    actor: Actor,
    stageId: string,
    workflowId: string,
    action: string,
  ): Promise<void> {
    await this.outbox.emit(client, {
      type: 'catalog.stage_changed',
      tenantId,
      actor,
      data: { stage_id: stageId, workflow_id: workflowId, action },
    });
  }
}

async function loadStage(client: PoolClient, id: string): Promise<StageDetail> {
  const res = await client.query<StageRow>(`SELECT ${STAGE_COLUMNS} FROM workflow_stages WHERE id = $1`, [id]);
  const row = res.rows[0];
  if (!row) throw new AppException('not_found', { detail: 'Stage not found' });
  return toStageDetail(row);
}

function toStageDetail(row: StageRow): StageDetail {
  return {
    id: row.id,
    workflow_id: row.workflow_id,
    code: row.code,
    label: row.label as StageDetail['label'],
    maps_to: row.maps_to,
    sort_order: row.sort_order,
    actor: row.actor,
    tracking_active: row.tracking_active,
    requires: row.requires,
    payment_action: row.payment_action,
    notify: row.notify,
    sla_minutes: row.sla_minutes,
  };
}
