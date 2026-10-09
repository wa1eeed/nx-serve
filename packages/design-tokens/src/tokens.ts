/**
 * One token source feeding web (CSS variables) and mobile (NativeWind theme),
 * overridden per tenant at runtime (ADR-0012, docs/21). Semantic color names so
 * a tenant's brand replaces the look without touching components.
 */
export interface ColorTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  warning: string;
  info: string;
  border: string;
  input: string;
  ring: string;
}

export const lightColors: ColorTokens = {
  background: '#ffffff',
  foreground: '#0b0b0f',
  card: '#ffffff',
  cardForeground: '#0b0b0f',
  primary: '#4f46e5',
  primaryForeground: '#ffffff',
  secondary: '#f1f1f5',
  secondaryForeground: '#1c1c22',
  accent: '#eef2ff',
  accentForeground: '#312e81',
  muted: '#f4f4f6',
  mutedForeground: '#6b6b76',
  destructive: '#dc2626',
  destructiveForeground: '#ffffff',
  success: '#16a34a',
  warning: '#d97706',
  info: '#2563eb',
  border: '#e6e6eb',
  input: '#e6e6eb',
  ring: '#4f46e5',
};

export const darkColors: ColorTokens = {
  background: '#0b0b0f',
  foreground: '#e7e7ea',
  card: '#121219',
  cardForeground: '#e7e7ea',
  primary: '#6c6cf0',
  primaryForeground: '#0b0b0f',
  secondary: '#1b1b22',
  secondaryForeground: '#e7e7ea',
  accent: '#1e1b3a',
  accentForeground: '#c7d2fe',
  muted: '#16161d',
  mutedForeground: '#a0a0ab',
  destructive: '#f87171',
  destructiveForeground: '#0b0b0f',
  success: '#4ade80',
  warning: '#fbbf24',
  info: '#60a5fa',
  border: '#23232b',
  input: '#23232b',
  ring: '#6c6cf0',
};

/** Categorical chart palette (chart-1..8), brand neutral defaults. */
export const chartPalette: readonly string[] = [
  '#4f46e5',
  '#0ea5e9',
  '#16a34a',
  '#d97706',
  '#db2777',
  '#9333ea',
  '#0d9488',
  '#dc2626',
];

export const radius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
};

export const fontFamily = {
  sans: "'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
};
