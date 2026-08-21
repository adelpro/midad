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