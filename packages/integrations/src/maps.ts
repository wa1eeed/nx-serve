import { type Logger, noopLogger } from './logger.js';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteLeg {
  distanceKm: number;
  durationMin: number;
}

export interface Route {
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalDurationMin: number;
}

/** Maps and routing behind an interface. Pricing uses routed distance, never straight line. */
export interface MapsProvider {
  route(stops: LatLng[]): Promise<Route>;
  geocode(query: string): Promise<LatLng | null>;
  etaMinutes(from: LatLng, to: LatLng): Promise<number>;
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Deterministic fake routing for local dev and tests. Approximates a road route
 * as straight line distance times a detour factor, and a city average speed.
 */
export class FakeMapsProvider implements MapsProvider {
  private readonly detourFactor = 1.3;
  private readonly avgSpeedKmh = 40;

  constructor(private readonly logger: Logger = noopLogger) {}

  route(stops: LatLng[]): Promise<Route> {
    const legs: RouteLeg[] = [];
    for (let i = 1; i < stops.length; i++) {
      const km = haversineKm(stops[i - 1] as LatLng, stops[i] as LatLng) * this.detourFactor;
      legs.push({ distanceKm: round2(km), durationMin: round2((km / this.avgSpeedKmh) * 60) });
    }
    const totalDistanceKm = round2(legs.reduce((s, l) => s + l.distanceKm, 0));
    const totalDurationMin = round2(legs.reduce((s, l) => s + l.durationMin, 0));
    this.logger.debug('route', { stops: stops.length, totalDistanceKm });
    return Promise.resolve({ legs, totalDistanceKm, totalDurationMin });
  }

  geocode(): Promise<LatLng | null> {
    // Riyadh centre as a deterministic stand-in.
    return Promise.resolve({ lat: 24.7136, lng: 46.6753 });
  }

  etaMinutes(from: LatLng, to: LatLng): Promise<number> {
    const km = haversineKm(from, to) * this.detourFactor;
    return Promise.resolve(round2((km / this.avgSpeedKmh) * 60));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
