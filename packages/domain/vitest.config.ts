import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: {
        // Money paths require 100% branch coverage (docs/19).
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
