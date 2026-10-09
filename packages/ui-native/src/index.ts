import { type ColorTokens, darkColors, lightColors } from '@nxserve/design-tokens';

export * from '@nxserve/design-tokens';

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Flattens color tokens into a NativeWind CSS variable object, loaded at runtime
 * from GET /v1/app/bootstrap and overridden per tenant (same names as web).
 * The React Native Reusables components themselves ship with the mobile apps;
 * this package keeps the shared token to variable mapping in one place.
 */
export function nativeColorVars(colors: ColorTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of Object.keys(colors) as (keyof ColorTokens)[]) {
    vars[`--nx-color-${kebab(String(key))}`] = colors[key];
  }
  return vars;
}

export const nativeTheme = {
  light: nativeColorVars(lightColors),
  dark: nativeColorVars(darkColors),
};
