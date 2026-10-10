import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service.js';

export interface CitySummary {
  id: string;
  country_code: string;
  name: Record<string, string>;
  timezone: string;
}

export interface ZoneSummary {
  id: string;
  city_id: string;
  name: Record<string, string>;
}

export interface AvailabilityRow {
  id: string;
  vertical_id: string;
  category_id: string | null;
  tier_id: string | null;
  city_id: string;
  zone_id: string | null;
  allow_intercity: boolean;
}

@Injectable()
export class GeoService {
  constructor(private readonly db: DbService) {}

  /** Cities are global reference data (no RLS); the app role may read them. */
  async listCities(): Promise<CitySummary[]> {
    const res = await this.db.app.query<CitySummary>(
      `SELECT id, country_code, name, timezone FROM cities WHERE is_active = true ORDER BY country_code`,
    );
    return res.rows;
  }

  async listZones(tenantId: string): Promise<ZoneSummary[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<ZoneSummary>(
        `SELECT id, city_id, name FROM zones WHERE is_active = true ORDER BY city_id`,
      );
      return res.rows;
    });
  }

  async listAvailability(tenantId: string): Promise<AvailabilityRow[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<AvailabilityRow>(
        `SELECT id, vertical_id, category_id, tier_id, city_id, zone_id, allow_intercity
         FROM service_availability WHERE is_active = true`,
      );
      return res.rows;
    });
  }
}
