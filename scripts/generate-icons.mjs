/**
 * generate-icons.mjs
 *
 * Regenerates all raster app icon assets from the brand logo
 * (assets/brand/midad.svg) into assets/images/:
 *
 *   - icon.png                      App icon (1024, logo on warm paper)
 *   - splash-icon.png               Splash image (512, transparent, centered)
 *   - splash-icon-dark.png          Splash image, light logo (512, transparent)
 *   - favicon.png                   PNG favicon fallback (48, transparent)
 *   - android-icon-foreground.png   Android adaptive foreground (transparent)
 *   - android-icon-monochrome.png   Android adaptive monochrome (white logo)
 *   - android-icon-background.png   Android adaptive background (solid paper)
 *
 * Run after changing assets/brand/midad.svg so the icons stay in sync:
 *
 *   node scripts/generate-icons.mjs
 *
 * Requires the `sharp` dev dependency. The warm-paper color (#F7F6F3) must
 * match the `backgroundColor` values in app.json.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'assets/brand/midad.svg');
const outDir = path.join(root, 'assets/images');

// Warm paper background (matches app.json splash)
const PAPER = { r: 247, g: 246, b: 243, alpha: 255 };

// Logo intrinsic aspect ratio (matches the crop in assets/brand/midad.svg)
const LOGO_W = 412;
const LOGO_H = 743;
const LOGO_ASPECT = LOGO_W / LOGO_H;

// Rasterize the raw logo (SVG) to a target height, preserving aspect.
//
// `invert` produces the light mark the dark splash needs: the brand SVG's fill is
// #05060A, which is invisible on the dark splash background (#111111). `negate`
// inverts RGB and keeps the alpha channel, so the mark turns light and the
// transparent surround stays transparent.
async function rasterLogo(targetHeight, invert = false) {
  const width = Math.round(targetHeight * LOGO_ASPECT);
  let pipeline = sharp(svgPath, { density: 72 })
    .resize(width, targetHeight)
    .ensureAlpha();
  if (invert) {
    pipeline = pipeline.negate({ alpha: false });
  }
  return pipeline.png().toBuffer();
}

// Build a square canvas with the logo centered and scaled to `availRatio` of the size.
async function makeCanvas({
  size,
  onPaper = false,
  availRatio = 0.7,
  invertLogo = false,
}) {
  const avail = Math.round(size * availRatio);
  const logoH = avail;
  // Re-rasterize the logo at exactly the target size for sharpness.
  const logoPng = await rasterLogo(logoH, invertLogo);
  const base = onPaper
    ? { r: PAPER.r, g: PAPER.g, b: PAPER.b, alpha: 255 }
    : { r: 0, g: 0, b: 0, alpha: 0 };

  return sharp({
    create: { width: size, height: size, channels: 4, background: base },
  })
    .composite([{ input: logoPng, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  // 1. icon.png — 1024, logo on warm paper
  const icon = await makeCanvas({
    size: 1024,
    onPaper: true,
    availRatio: 0.85,
  });
  await sharp(icon).toFile(path.join(outDir, 'icon.png'));
  console.log('icon.png (1024, paper)');

  // 2. splash-icon.png — 512, transparent, centered. The mark fills 0.72 of the
  // frame so its on-device size is ~0.72 of `imageWidth` rather than ~0.56 of it.
  const splash = await makeCanvas({
    size: 1024,
    onPaper: false,
    availRatio: 0.72,
  });
  await sharp(splash)
    .resize(512, 512)
    .toFile(path.join(outDir, 'splash-icon.png'));
  console.log('splash-icon.png (512, transparent)');

  // 2b. splash-icon-dark.png — the same crop with a light logo. app.json points
  // the splash plugin's `dark.image` at it; without it the black mark sits on the
  // #111111 dark background and disappears.
  const splashDark = await makeCanvas({
    size: 1024,
    onPaper: false,
    availRatio: 0.72,
    invertLogo: true,
  });
  await sharp(splashDark)
    .resize(512, 512)
    .toFile(path.join(outDir, 'splash-icon-dark.png'));
  console.log('splash-icon-dark.png (512, transparent, light logo)');

  // 3. favicon.png — 48, transparent background (blends into the browser tab)
  const favicon = await makeCanvas({
    size: 64,
    onPaper: false,
    availRatio: 0.92,
  });
  await sharp(favicon).resize(48, 48).toFile(path.join(outDir, 'favicon.png'));
  console.log('favicon.png (48, transparent)');

  // 4. android foreground — 1024 transparent, logo in safe zone. 0.60 is a
  // ceiling rather than a taste choice: the adaptive-icon safe zone is
  // 66/108 = 61.1% of the canvas, and a larger mark would be clipped by a
  // launcher's mask.
  const fg = await makeCanvas({ size: 1024, onPaper: false, availRatio: 0.6 });
  await sharp(fg).toFile(path.join(outDir, 'android-icon-foreground.png'));
  console.log('android-icon-foreground.png (1024, transparent)');

  // 5. android monochrome — white logo on transparent
  const monoPng = await sharp(svgPath, { density: 72 })
    .resize(Math.round(512 * LOGO_ASPECT), 512)
    .ensureAlpha()
    .modulate({ brightness: 5 }) // push to white
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: monoPng, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, 'android-icon-monochrome.png'));
  console.log('android-icon-monochrome.png (1024, white)');

  // 6. android background — solid paper
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: PAPER },
  })
    .png()
    .toFile(path.join(outDir, 'android-icon-background.png'));
  console.log('android-icon-background.png (1024, paper)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
