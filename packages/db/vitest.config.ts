import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Testcontainers starts a real PostGIS database; allow time for image pull and boot.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    pool: 'forks',
    fileParallelism: false,
  },
});
