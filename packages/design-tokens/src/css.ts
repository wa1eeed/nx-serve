import {
  type ColorTokens,
  chartPalette,
  darkColors,
  fontFamily,
  lightColors,
  radius,
} from './tokens.js';

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Flattens color tokens into `--nx-color-*` CSS variable declarations. */
export function colorVars(colors: ColorTokens): string {
  return (Object.keys(colors) as (keyof ColorTokens)[])
    .map((key) => `  --nx-color-${kebab(String(key))}: ${colors[key]};`)
    .join('\n');
}

function staticVars(): string {
  const chart = chartPalette.map((c, i) => `  --nx-chart-${i + 1}: ${c};`).join('\n');
  return [
    `  --nx-radius-sm: ${radius.sm};`,
    `  --nx-radius-md: ${radius.md};`,
    `  --nx-radius-lg: ${radius.lg};`,
    `  --nx-radius-xl: ${radius.xl};`,
    `  --nx-font-sans: ${fontFamily.sans};`,
    `  --nx-font-mono: ${fontFamily.mono};`,
    chart,
  ].join('\n');
}

/**
 * The base stylesheet: light tokens on :root, dark tokens under both the system
 * preference (unless light is forced) and an explicit [data-theme="dark"].
 * Tenant branding injects a further <style> overriding these variables at runtime.
 */
export function buildTokensCss(): string {
  return `:root {
${colorVars(lightColors)}
${staticVars()}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${colorVars(darkColors)}
  }
}

:root[data-theme="dark"] {
${colorVars(darkColors)}
}
`;
}
