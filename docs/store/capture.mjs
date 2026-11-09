#!/usr/bin/env node
/**
 * Capture the midad web export at the two store shapes.
 *
 *   yarn build:check                      # dist/
 *   node docs/store/capture.mjs           # writes docs/store/captures/
 *
 * iPhone:  440 x 956 CSS @3x = 1320 x 2868 (App Store 6.9")
 * Android: 360 x 640 CSS @3x = 1080 x 1920 (Google Play 9:16)
 *
 * The script serves `dist/` itself (so the run needs no second terminal and the
 * shots never carry a hosting badge) and drives the real UI: a new design, the
 * text sheet, the font picker, the split action and the export sheet. Nothing
 * is seeded into storage, so what is captured is what a first run shows.
 *
 * SHOT_URL points the run at another origin (the deployed site) instead.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = process.env.CAPTURE_OUT ?? path.join(HERE, 'captures');
const MODULE = process.env.PLAYWRIGHT_MODULE ?? 'playwright';

const LINE = 'الخطُّ هندسةٌ روحانية';
const WORD = 'مداد';
const FACE = 'أمشرف ثلث';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = await import(pathToFileURL(require.resolve(MODULE)).href);
} catch (error) {
  console.error(`Cannot load ${MODULE}: ${error.message}`);
  console.error('  npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}
const chromium = playwright.chromium ?? playwright.default?.chromium;
if (!chromium) {
  console.error(`${MODULE} has no chromium export.`);
  process.exit(1);
}

/* ---------------------------------------------------------------- server ---- */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** The export writes one .html per route, so /gallery is dist/gallery.html. */
const resolveFile = (urlPath) => {
  const clean = decodeURIComponent((urlPath ?? '/').split('?')[0]);
  const direct = path.join(ROOT, 'dist', clean);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const html = `${direct.replace(/\/$/, '')}.html`;
  if (existsSync(html)) return html;
  const index = path.join(ROOT, 'dist', 'index.html');
  return existsSync(index) ? index : null;
};

const startServer = async () => {
  if (!existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    console.error('No dist/ export found. Run `yarn build:check` first.');
    process.exit(1);
  }
  const server = createServer((req, res) => {
    const file = resolveFile(req.url);
    if (!file) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

/* --------------------------------------------------------------- driving ---- */

const devices = [
  { key: 'iphone', viewport: { width: 440, height: 956 }, scale: 3 },
  { key: 'android', viewport: { width: 360, height: 640 }, scale: 3 },
];

const waitFonts = (page) => page.evaluate(() => document.fonts.ready);

/** The page canvas, used for taps that have to miss every object. */
const canvasBox = async (page) => {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('no canvas on the editor');
  return box;
};

/** Insert `text` in the Thuluth face and grow it until it nearly fills the page. */
const insertText = async (page, text, { width, extra = 0 }) => {
  await page.getByRole('button', { name: 'نص', exact: true }).click();
  await page.getByRole('textbox', { name: 'اكتب نصك هنا…' }).fill(text);
  await page.getByRole('button', { name: /اختيار الخط/ }).click();
  await page.getByRole('textbox', { name: 'ابحث عن خط' }).fill('ثلث');
  await page
    .getByRole('button', { name: new RegExp(`^${FACE}`) })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'إغلاق' })
    .click({ timeout: 3_000 })
    .catch(() => {});
  await page.getByRole('button', { name: 'تم' }).click();

  // Each press scales the object by a fixed factor; stop when the line spans
  // most of the page width. 96px is the sheet's default.
  const presses =
    Math.max(1, Math.round(Math.log((width * 0.42) / 96) / Math.log(1.1))) +
    extra;
  for (let i = 0; i < presses; i += 1) {
    await page.getByRole('button', { name: 'تكبير العنصر' }).click();
  }
  await waitFonts(page);
};

const newDesign = async (page, url, name) => {
  await page.goto(`${url}/gallery`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'تصميم جديد' }).first().click();
  await page
    .getByRole('button', { name: 'نص', exact: true })
    .waitFor({ timeout: 60_000 });
  // The header title is the design's name; give the card something better than
  // the default before it is captured in the gallery.
  await page.getByRole('button', { name: 'لوحة جديدة' }).click();
  await page.getByRole('textbox', { name: 'اسم التصميم' }).fill(name);
  await page.getByRole('button', { name: 'حفظ' }).click();
  await page
    .getByRole('button', { name, exact: true })
    .waitFor({ timeout: 10_000 });
};

/** Header menu → Save. The only path that rasterizes a gallery thumbnail on web. */
const saveDesign = async (page) => {
  await page.getByRole('button', { name: 'المزيد' }).first().click();
  await page.getByRole('button', { name: 'حفظ' }).click();
  await page.waitForTimeout(2_500);
};

const shoot = async (page, file) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
  console.log(`  ${path.basename(file)}`);
};

/* ------------------------------------------------------------------ main ---- */

const shots = [
  {
    name: '01-editor',
    async run(page, url) {
      await newDesign(page, url, 'مِداد');
      await insertText(page, LINE, { width: page.viewportSize().width });
      const box = await canvasBox(page);
      await page.mouse.click(box.x + box.width / 2, box.y + 60);
      await page.keyboard.press('Escape');
    },
  },
  {
    name: '02-export',
    async run(page) {
      // An explicit save is what rasterizes the gallery thumbnail on web, so the
      // gallery shot later has a real card rather than an empty placeholder.
      await saveDesign(page);
      await page.getByRole('button', { name: 'المزيد' }).first().click();
      await page.getByRole('button', { name: 'تصدير' }).click();
      await page.getByRole('button', { name: 'تصدير SVG' }).waitFor();
    },
  },
  {
    name: '03-fonts',
    async run(page) {
      // The export sheet is modal; a reload drops it and keeps the design.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page
        .getByRole('button', { name: 'نص', exact: true })
        .waitFor({ timeout: 60_000 });
      await page.getByRole('button', { name: 'نص', exact: true }).click();
      await page.getByRole('button', { name: /اختيار الخط/ }).click();
      await page.getByRole('button', { name: 'الخطوط العربية' }).waitFor();
    },
  },
  {
    name: '04-split',
    async run(page, url) {
      await newDesign(page, url, 'مقطع');
      await insertText(page, WORD, {
        width: page.viewportSize().width,
        extra: 3,
      });
      await saveDesign(page);
      await page.getByRole('button', { name: 'تقسيم النص إلى أجزاء' }).click();
      await page
        .getByRole('button', { name: 'تم' })
        .waitFor({ timeout: 5_000 })
        .catch(() => {});
    },
  },
  {
    name: '05-gallery',
    async run(page, url) {
      await page.goto(`${url}/gallery`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'تصميم جديد' }).first().waitFor();
      await page.getByText('مقطع').first().waitFor({ timeout: 10_000 });
    },
  },
];

mkdirSync(OUT, { recursive: true });

const local = process.env.SHOT_URL ? null : await startServer();
const site = process.env.SHOT_URL ?? local.url;

const browser = await chromium.launch().catch(async (error) => {
  if (!/Executable doesn't exist/.test(error.message)) throw error;
  return chromium.launch({ channel: 'chrome' });
});

try {
  for (const device of devices) {
    console.log(
      `${device.key} (${device.viewport.width}x${device.viewport.height}@${device.scale})`,
    );
    const context = await browser.newContext({
      viewport: device.viewport,
      deviceScaleFactor: device.scale,
      locale: 'ar',
      colorScheme: 'light',
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const shootSpec of shots) {
      await shootSpec.run(page, site);
      await shoot(page, path.join(OUT, `${device.key}-${shootSpec.name}.png`));
    }

    if (errors.length) console.log(`  console errors: ${errors.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
  local?.server.close();
}

console.log(`captures in ${OUT}`);
