import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service.js';

export interface VehicleMakeSummary {
  id: string;
  code: string;
  name: Record<string, string>;
  logo_url: string | null;
}

export interface VehicleModelSummary {
  id: string;
  make_id: string;
  code: string;
  name: Record<string, string>;
  body_type_id: string;
  year_from: number | null;
  year_to: number | null;
  drivetrain: string | null;
  default_class: string | null;
}

export interface VehicleClassSummary {
  id: string;
  code: string;
  name: Record<string, string>;
  sort_order: number;
}

@Injectable()
export class VehiclesService {
  constructor(private readonly db: DbService) {}

  async listMakes(): Promise<VehicleMakeSummary[]> {
    const res = await this.db.app.query<VehicleMakeSummary>(
      `SELECT id, code, name, logo_url FROM vehicle_makes WHERE is_active = true ORDER BY code`,
    );
    return res.rows;
  }

  async listModels(makeId?: string): Promise<VehicleModelSummary[]> {
    const res = makeId
      ? await this.db.app.query<VehicleModelSummary>(
          `SELECT id, make_id, code, name, body_type_id, year_from, year_to, drivetrain, default_class
           FROM vehicle_models WHERE is_active = true AND make_id = $1 ORDER BY code`,
          [makeId],
        )
      : await this.db.app.query<VehicleModelSummary>(
          `SELECT id, make_id, code, name, body_type_id, year_from, year_to, drivetrain, default_class
           FROM vehicle_models WHERE is_active = true ORDER BY code`,
        );
    return res.rows;
  }

  async listClasses(tenantId: string): Promise<VehicleClassSummary[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<VehicleClassSummary>(
        `SELECT id, code, name, sort_order FROM vehicle_classes ORDER BY sort_order`,
      );
      return res.rows;
    });
  }
}
