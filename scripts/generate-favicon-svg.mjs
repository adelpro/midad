/**
 * generate-favicon-svg.mjs
 *
 * Generates the adaptive web favicon (assets/images/favicon.svg) from the
 * brand logo path (assets/brand/midad.svg).
 *
 * The favicon is an SVG with a transparent background whose logo color
 * adapts to the browser theme via `prefers-color-scheme`:
 *   - light tabs → ink logo (#05060A)
 *   - dark tabs  → warm paper logo (#F7F6F3)
 *
 * The generated file is committed to assets/images/favicon.svg and served
 * on web through /public/favicon.svg (a copy is kept in the public folder
 * for Expo static output). Run after changing the brand logo:
 *
 *   node scripts/generate-favicon-svg.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const brand = readFileSync(path.join(root, 'assets/brand/midad.svg'), 'utf8');
const pathMatch = brand.match(/<path[^>]*d="([^"]+)"/);
const vbMatch = brand.match(/viewBox="([^"]+)"/);

if (!pathMatch || !vbMatch) {
  console.error('Could not extract path from midad.svg');
  process.exit(1);
}

const d = pathMatch[1];
const viewBox = vbMatch[1];

// Adaptive SVG favicon: ink logo on light tabs, light logo on dark tabs,
// transparent background in both. Modern browsers honor prefers-color-scheme.
const favicon = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <style>
    .logo { fill: #05060A; }
    @media (prefers-color-scheme: dark) {
      .logo { fill: #F7F6F3; }
    }
  </style>
  <path class="logo" d="${d}"/>
</svg>`;

const out = path.join(root, 'assets/images/favicon.svg');
writeFileSync(out, favicon);
console.log('wrote', out);