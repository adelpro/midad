/**
 * Standalone verification for the export write-encoding decision.
 *
 * The share writer used to pick base64 whenever the mime type started with
 * `image/`, which base64-decoded raw SVG XML and failed with "bad base-64".
 * This pins the decision to the payload shape instead.
 *
 * Run: node scripts/check-export-payload.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, '..', 'src', 'storage', 'export-payload.ts'),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const shim = { exports: {} };
new Function('exports', 'module', outputText)(shim.exports, shim);
const { base64BodyOf, stringWriteEncoding } = shim.exports;

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL: ${m}`);
};
const eq = (label, got, want) => {
  if (got !== want) fail(`${label}: got ${got}, want ${want}`);
};

const png = 'data:image/png;base64,AAAABBBB';
eq('png data URI is base64', stringWriteEncoding(png), 'base64');
eq('png body drops the prefix', base64BodyOf(png), 'AAAABBBB');

// The regression: an SVG is a text string, whether or not its mime is image/*.
const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>';
eq('svg text is utf8', stringWriteEncoding(svg), 'utf8');

// A non-base64 data URI is still text.
eq(
  'plaintext data URI is utf8',
  stringWriteEncoding('data:text/plain,hello'),
  'utf8',
);
eq('json text is utf8', stringWriteEncoding('{"a":1}'), 'utf8');

if (failures > 0) {
  console.error(`\ncheck-export-payload: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-export-payload: OK');
