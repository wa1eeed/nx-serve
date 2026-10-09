import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore no bundled types
import Converter from 'openapi-to-postmanv2';
import { buildOpenApiDocument } from '../src/openapi.js';

interface ConvertResult {
  result: boolean;
  reason?: string;
  output?: { type: string; data: unknown }[];
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'openapi');
mkdirSync(outDir, { recursive: true });
const doc = buildOpenApiDocument();

const convert = Converter.convert as (
  input: { type: string; data: unknown },
  options: Record<string, unknown>,
  cb: (err: Error | null, result: ConvertResult) => void,
) => void;

convert({ type: 'json', data: doc }, { folderStrategy: 'Tags' }, (err, result) => {
  if (err || !result.result || !result.output?.[0]) {
    // eslint-disable-next-line no-console
    console.error('Postman conversion failed:', err ?? result.reason);
    process.exit(1);
  }
  const path = join(outDir, 'postman.collection.json');
  writeFileSync(path, `${JSON.stringify(result.output[0].data, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Postman collection written to ${path}.`);
});
