import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from '../src/openapi.js';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'openapi');
mkdirSync(outDir, { recursive: true });

const doc = buildOpenApiDocument();
const path = join(outDir, 'openapi.json');
writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

const pathCount = Object.keys(doc.paths ?? {}).length;
// eslint-disable-next-line no-console
console.log(`OpenAPI 3.1 written to ${path} (${pathCount} paths).`);
