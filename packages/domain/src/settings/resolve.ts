/**
 * Hierarchical settings resolver (docs/10 section 8). Resolution order:
 * platform > plan > tenant_group > tenant > provider. A higher level can lock a
 * key so lower levels cannot change it, or bound it (min/max) so lower levels
 * choose within limits. The lowest allowed, not-locked-above value wins, clamped.
 */

export type SettingLevel = 'platform' | 'plan' | 'tenant_group' | 'tenant' | 'provider';

const ORDER: readonly SettingLevel[] = ['platform', 'plan', 'tenant_group', 'tenant', 'provider'];

export interface SettingValueAtLevel {
  level: SettingLevel;
  value?: unknown;
  min?: number | null;
  max?: number | null;
  locked?: boolean;
}

export interface SettingDefinitionInput {
  defaultValue: unknown;
}

function clampNumber(value: unknown, min: number | undefined, max: number | undefined): unknown {
  if (typeof value !== 'number') return value;
  let v = value;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

/** Resolves the effective value of a setting across levels. */
export function resolveSetting(
  def: SettingDefinitionInput,
  levelValues: readonly SettingValueAtLevel[],
): unknown {
  const byLevel = new Map<SettingLevel, SettingValueAtLevel>();
  for (const lv of levelValues) byLevel.set(lv.level, lv);

  let value: unknown = def.defaultValue;
  let min: number | undefined;
  let max: number | undefined;
  let lockedAbove = false;

  for (const level of ORDER) {
    const lv = byLevel.get(level);
    if (!lv) continue;

    if (!lockedAbove && lv.value !== undefined) {
      value = clampNumber(lv.value, min, max);
    }
    // Upper-level bounds tighten what lower levels may choose.
    if (typeof lv.min === 'number') min = min === undefined ? lv.min : Math.max(min, lv.min);
    if (typeof lv.max === 'number') max = max === undefined ? lv.max : Math.min(max, lv.max);
    if (lv.locked === true) lockedAbove = true;
  }

  return value;
}
