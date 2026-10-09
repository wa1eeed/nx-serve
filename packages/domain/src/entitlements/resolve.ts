/**
 * Entitlements resolver (docs/10): effective modules and limits from a plan
 * version plus add-ons, per-tenant overrides, and module dependencies. Pure and
 * cached by the API; every module and limit check reads the result.
 */

export interface ModuleDependency {
  requires: string;
  hard: boolean;
}

export interface ModuleDef {
  code: string;
  kind: 'service' | 'capability';
  dependencies?: ModuleDependency[];
}

export interface PlanVersionEntitlements {
  modules: string[];
  limits: Record<string, number | null>;
  allServiceModules?: boolean;
}

export interface EntitlementAddon {
  moduleCode?: string;
  limitCode?: string;
  limitDelta?: number;
  quantity?: number;
}

export interface EntitlementOverride {
  moduleCode?: string;
  enabled?: boolean;
  limitCode?: string;
  value?: number | null;
  expiresAt?: Date;
}

export interface EffectiveEntitlements {
  modules: Set<string>;
  limits: Record<string, number | null>;
}

export interface ResolveEntitlementsInput {
  plan: PlanVersionEntitlements;
  addons?: EntitlementAddon[];
  overrides?: EntitlementOverride[];
  moduleCatalog: ModuleDef[];
  now?: Date;
}

export function resolveEntitlements(input: ResolveEntitlementsInput): EffectiveEntitlements {
  const now = input.now ?? new Date();
  const byCode = new Map(input.moduleCatalog.map((m) => [m.code, m]));
  const modules = new Set(input.plan.modules);

  if (input.plan.allServiceModules) {
    for (const m of input.moduleCatalog) {
      if (m.kind === 'service') modules.add(m.code);
    }
  }

  const limits: Record<string, number | null> = { ...input.plan.limits };

  for (const addon of input.addons ?? []) {
    if (addon.moduleCode) modules.add(addon.moduleCode);
    if (addon.limitCode && addon.limitDelta !== undefined) {
      const current = limits[addon.limitCode];
      if (current !== null) {
        limits[addon.limitCode] = (current ?? 0) + addon.limitDelta * (addon.quantity ?? 1);
      }
    }
  }

  for (const override of input.overrides ?? []) {
    if (override.expiresAt && override.expiresAt.getTime() < now.getTime()) continue;
    if (override.moduleCode) {
      if (override.enabled === true) modules.add(override.moduleCode);
      else if (override.enabled === false) modules.delete(override.moduleCode);
    }
    if (override.limitCode && override.value !== undefined) {
      limits[override.limitCode] = override.value;
    }
  }

  // Remove modules whose hard dependencies are not satisfied (fixpoint).
  let changed = true;
  while (changed) {
    changed = false;
    for (const code of [...modules]) {
      const def = byCode.get(code);
      if (!def) continue;
      for (const dep of def.dependencies ?? []) {
        if (dep.hard && !modules.has(dep.requires)) {
          modules.delete(code);
          changed = true;
          break;
        }
      }
    }
  }

  return { modules, limits };
}

/** True when the tenant is entitled to a module. */
export function hasModule(entitlements: EffectiveEntitlements, moduleCode: string): boolean {
  return entitlements.modules.has(moduleCode);
}

/** The effective limit for a code; null means unlimited, undefined means uncapped. */
export function limitFor(
  entitlements: EffectiveEntitlements,
  limitCode: string,
): number | null | undefined {
  return entitlements.limits[limitCode];
}
