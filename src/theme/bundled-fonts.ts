/**
 * The bundled display faces a set of stored font keys needs, de-duplicated.
 *
 * Keys that are not bundled display faces — remote keys, unknown or removed
 * faces, and the always-loaded core — are ignored. Pure and import-free on
 * purpose: `scripts/check-fonts.mjs` transpiles and evaluates it standalone,
 * the same way the other check scripts treat their targets, so it takes the
 * display key set as a parameter rather than importing it.
 */
export function bundledDisplayKeysFor(
  fontKeys: Iterable<string>,
  displayKeys: ReadonlySet<string>,
): string[] {
  const out = new Set<string>();
  for (const key of fontKeys) {
    if (displayKeys.has(key)) out.add(key);
  }
  return [...out];
}
