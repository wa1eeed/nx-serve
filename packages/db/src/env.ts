/**
 * Database connection URLs by role. Defaults match infra/compose for local dev,
 * so the CLIs work without a .env file; override via environment in CI and staging.
 *
 * - owner: runs migrations (DDL) only, never serves requests.
 * - app: the non owner role the API connects as; RLS is enforced for it.
 * - superadmin: BYPASSRLS, used for reference data seeds and the platform admin backend.
 */
export interface DbUrls {
  owner: string;
  app: string;
  superadmin: string;
}

export function dbUrls(): DbUrls {
  return {
    owner:
      process.env.DATABASE_MIGRATION_URL ??
      'postgres://nxserve_owner:nxserve_owner@localhost:5544/nxserve',
    app: process.env.DATABASE_URL ?? 'postgres://nxserve_app:nxserve_app@localhost:5544/nxserve',
    superadmin:
      process.env.DATABASE_SUPERADMIN_URL ??
      'postgres://nxserve_superadmin:nxserve_superadmin@localhost:5544/nxserve',
  };
}
