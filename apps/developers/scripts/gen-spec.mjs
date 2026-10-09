// Generates the OpenAPI spec into public/ so the reference renders it.
// @nxserve/contracts is the single source; its build runs first (turbo ^build).
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildOpenApiDocument } from '@nxserve/contracts';

mkdirSync('public', { recursive: true });
writeFileSync('public/openapi.json', `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`, 'utf8');
// eslint-disable-next-line no-console
console.log('Wrote public/openapi.json');
