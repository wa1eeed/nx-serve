/**
 * i18n parity gate (docs/24). Fails CI when the ar catalog is missing a key the
 * en source has, has an extra key, or when a message's ICU argument names differ
 * between locales. Keeping this cheap and strict stops drift early.
 */
import { LOCALES, SOURCE_LOCALE, icuArgumentNames, loadCatalog, type Locale } from '../src/index.js';

function setDifference(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

function main(): void {
  const source = loadCatalog(SOURCE_LOCALE);
  const sourceKeys = new Set(Object.keys(source));
  const problems: string[] = [];

  for (const locale of LOCALES) {
    if (locale === SOURCE_LOCALE) continue;
    const target = loadCatalog(locale as Locale);
    const targetKeys = new Set(Object.keys(target));

    const missing = setDifference(sourceKeys, targetKeys);
    const extra = setDifference(targetKeys, sourceKeys);
    for (const key of missing) problems.push(`[${locale}] missing key: ${key}`);
    for (const key of extra) problems.push(`[${locale}] extra key not in ${SOURCE_LOCALE}: ${key}`);

    for (const key of sourceKeys) {
      if (!targetKeys.has(key)) continue;
      const sourceArgs = icuArgumentNames(source[key] ?? '');
      const targetArgs = icuArgumentNames(target[key] ?? '');
      const missingArgs = setDifference(sourceArgs, targetArgs);
      const extraArgs = setDifference(targetArgs, sourceArgs);
      if (missingArgs.length > 0) {
        problems.push(`[${locale}] ${key}: missing ICU args ${missingArgs.join(', ')}`);
      }
      if (extraArgs.length > 0) {
        problems.push(`[${locale}] ${key}: unexpected ICU args ${extraArgs.join(', ')}`);
      }
    }
  }

  if (problems.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`i18n parity check failed with ${problems.length} problem(s):`);
    for (const p of problems) {
      // eslint-disable-next-line no-console
      console.error(`  - ${p}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`i18n parity OK: ${sourceKeys.size} keys across ${LOCALES.length} locales.`);
}

main();
