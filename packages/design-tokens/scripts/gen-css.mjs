import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTokensCss } from '../dist/index.js';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'tokens.css');
writeFileSync(out, buildTokensCss(), 'utf8');
// eslint-disable-next-line no-console
console.log(`Wrote ${out}`);
