import { describe, expect, it } from 'vitest';
import {
  type ModuleDef,
  hasModule,
  limitFor,
  resolveEntitlements,
} from './resolve.js';

const catalog: ModuleDef[] = [
  { code: 'towing', kind: 'service', dependencies: [{ requires: 'live_tracking', hard: true }] },
  { code: 'moving', kind: 'service' },
  { code: 'live_tracking', kind: 'capability' },
  { code: 'branded_apps', kind: 'capability' },
  { code: 'public_api', kind: 'capability' },
];

describe('resolveEntitlements', () => {
  it('starts from the plan modules and limits', () => {
    const e = resolveEntitlements({
      plan: { modules: ['towing', 'live_tracking'], limits: { max_providers: 10 } },
      moduleCatalog: catalog,
    });
    expect(hasModule(e, 'towing')).toBe(true);
    expect(limitFor(e, 'max_providers')).toBe(10);
    expect(hasModule(e, 'branded_apps')).toBe(false);
  });

  it('grants every service module when allServiceModules is set', () => {
    const e = resolveEntitlements({
      plan: { modules: ['live_tracking'], limits: {}, allServiceModules: true },
      moduleCatalog: catalog,
    });
    expect(hasModule(e, 'towing')).toBe(true);
    expect(hasModule(e, 'moving')).toBe(true);
    expect(hasModule(e, 'branded_apps')).toBe(false);
  });

  it('applies add-ons for modules and limits, leaving unlimited untouched', () => {
    const e = resolveEntitlements({
      plan: { modules: ['live_tracking'], limits: { max_agents: 5, max_cities: null } },
      addons: [
        { moduleCode: 'branded_apps' },
        { limitCode: 'max_agents', limitDelta: 10, quantity: 2 },
        { limitCode: 'max_cities', limitDelta: 3 },
        { limitCode: 'orders_per_month', limitDelta: 100 },
      ],
      moduleCatalog: catalog,
    });
    expect(hasModule(e, 'branded_apps')).toBe(true);
    expect(limitFor(e, 'max_agents')).toBe(25);
    expect(limitFor(e, 'max_cities')).toBeNull();
    expect(limitFor(e, 'orders_per_month')).toBe(100);
  });

  it('applies non-expired overrides and skips expired ones', () => {
    const past = new Date('2020-01-01');
    const future = new Date('2100-01-01');
    const e = resolveEntitlements({
      plan: { modules: ['towing', 'live_tracking'], limits: { max_agents: 5 } },
      overrides: [
        { moduleCode: 'towing', enabled: false },
        { moduleCode: 'public_api', enabled: true, expiresAt: future },
        { moduleCode: 'branded_apps', enabled: true, expiresAt: past },
        { limitCode: 'max_agents', value: 99 },
      ],
      moduleCatalog: catalog,
      now: new Date('2026-10-10'),
    });
    expect(hasModule(e, 'towing')).toBe(false);
    expect(hasModule(e, 'public_api')).toBe(true);
    expect(hasModule(e, 'branded_apps')).toBe(false);
    expect(limitFor(e, 'max_agents')).toBe(99);
  });

  it('keeps unknown modules and modules with only soft dependencies', () => {
    const cat: ModuleDef[] = [
      ...catalog,
      { code: 'reports', kind: 'capability', dependencies: [{ requires: 'missing', hard: false }] },
    ];
    const e = resolveEntitlements({
      plan: { modules: ['ghost', 'reports', 'live_tracking'], limits: {} },
      overrides: [{ moduleCode: 'live_tracking' }],
      moduleCatalog: cat,
    });
    expect(hasModule(e, 'reports')).toBe(true);
    expect(hasModule(e, 'ghost')).toBe(true);
    expect(hasModule(e, 'live_tracking')).toBe(true);
  });

  it('removes modules whose hard dependency is not entitled', () => {
    const e = resolveEntitlements({
      plan: { modules: ['towing'], limits: {} },
      moduleCatalog: catalog,
    });
    // towing needs live_tracking (hard), which is not entitled.
    expect(hasModule(e, 'towing')).toBe(false);
    expect(limitFor(e, 'nonexistent')).toBeUndefined();
  });
});
