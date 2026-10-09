import { describe, expect, it } from 'vitest';
import { LOCALES, icuArgumentNames, loadCatalog } from './index.js';

describe('catalogs', () => {
  it('ar is at full key parity with en', () => {
    const en = loadCatalog('en');
    const ar = loadCatalog('ar');
    expect(new Set(Object.keys(ar))).toEqual(new Set(Object.keys(en)));
  });

  it('ICU argument names match between locales for every key', () => {
    const en = loadCatalog('en');
    const ar = loadCatalog('ar');
    for (const key of Object.keys(en)) {
      expect(icuArgumentNames(ar[key] ?? '')).toEqual(icuArgumentNames(en[key] ?? ''));
    }
  });

  it('exposes exactly the launch locales', () => {
    expect([...LOCALES]).toEqual(['en', 'ar']);
  });

  it('extracts ICU argument names and ignores keywords', () => {
    expect(icuArgumentNames('{minutes, plural, one {# minute} other {# minutes}}')).toEqual(
      new Set(['minutes']),
    );
    expect(icuArgumentNames('no placeholders')).toEqual(new Set());
  });
});
