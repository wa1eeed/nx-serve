import { describe, expect, it } from 'vitest';
import { nativeColorVars, nativeTheme } from './index.js';
import { lightColors } from '@nxserve/design-tokens';

describe('nativeColorVars', () => {
  it('maps tokens to kebab-case CSS variables matching web', () => {
    const vars = nativeColorVars(lightColors);
    expect(vars['--nx-color-primary']).toBe(lightColors.primary);
    expect(vars['--nx-color-primary-foreground']).toBe(lightColors.primaryForeground);
  });

  it('exposes a light and dark theme', () => {
    expect(nativeTheme.light['--nx-color-background']).toBeDefined();
    expect(nativeTheme.dark['--nx-color-background']).toBeDefined();
  });
});
