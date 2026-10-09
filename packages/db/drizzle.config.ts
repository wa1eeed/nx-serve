import { defineConfig } from 'drizzle-kit';
import { dbUrls } from './src/env.js';

/**
 * SQL migrations are the source of truth (ADR-0002, CLAUDE.md). The Drizzle
 * schema is generated FROM the migrated database by `pnpm --filter @nxserve/db pull`,
 * so typed queries always mirror the real schema, RLS policies and partitions.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: { url: dbUrls().owner },
  schemaFilter: ['public'],
  casing: 'snake_case',
});
