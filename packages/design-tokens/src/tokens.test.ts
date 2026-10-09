import { describe, expect, it } from 'vitest';
import { buildTokensCss, colorVars, lightColors, lockedFeatureModel } from './index.js';

describe('design tokens', () => {
  it('emits kebab-case color variables', () => {
    const css = colorVars(lightColors);
    expect(css).toContain('--nx-color-primary: #4f46e5;');
    expect(css).toContain('--nx-color-primary-foreground: #ffffff;');
  });

  it('builds a stylesheet with light, system-dark and forced-dark blocks', () => {
    const css = buildTokensCss();
    expect(css).toContain(':root {');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain('--nx-font-sans');
    expect(css).toContain('--nx-chart-1');
  });

  it('models a locked feature', () => {
    expect(lockedFeatureModel('Advanced')).toEqual({
      requiredPlan: 'Advanced',
      badge: 'Advanced plan',
      ctaKey: 'upgrade.cta',
    });
  });
});
