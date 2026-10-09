import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** Locales shipped at launch. The source is `en`; `ar` is kept at full parity. */
export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const SOURCE_LOCALE: Locale = 'en';

/** A flat message catalog keyed by namespaced message id. */
export type MessageCatalog = Record<string, string>;

const localesDir = join(dirname(fileURLToPath(import.meta.url)), 'locales');

/** Loads a locale catalog from disk. */
export function loadCatalog(locale: Locale): MessageCatalog {
  const raw = readFileSync(join(localesDir, `${locale}.json`), 'utf8');
  return JSON.parse(raw) as MessageCatalog;
}

/** Extracts top level ICU argument names from a message, e.g. {minutes, plural, ...} -> minutes. */
export function icuArgumentNames(message: string): Set<string> {
  const names = new Set<string>();
  // A true ICU argument is `{name}` or `{name, type ...}`: the identifier is
  // immediately followed by `,` or `}`. This avoids matching literal text inside
  // plural or select branches such as `zero {no minutes}`.
  const re = /\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(message)) !== null) {
    const name = match[1];
    // Skip ICU keywords that can appear where an argument name would.
    if (name !== undefined && !ICU_KEYWORDS.has(name)) {
      names.add(name);
    }
  }
  return names;
}

const ICU_KEYWORDS = new Set([
  'plural',
  'select',
  'selectordinal',
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
]);
