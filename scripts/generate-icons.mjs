/**
 * generate-icons.mjs
 *
 * Regenerates all raster app icon assets from the brand logo
 * (assets/brand/midad.svg) into assets/images/:
 *
 *   - icon.png                      App icon (1024, logo on warm paper)
 *   - splash-icon.png               Splash image (512, transparent, centered)
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
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'assets/brand/midad.svg');
const outDir = path.join(root, 'assets/images');

// Warm paper background (matches app.json splash)
const PAPER = { r: 247, g: 246, b: 243, alpha: 255 };

// Logo intrinsic aspect ratio
const LOGO_W = 735;
const LOGO_H = 957;
const LOGO_ASPECT = LOGO_W / LOGO_H;

// Rasterize the raw logo (SVG) to a target height, preserving aspect.
async function rasterLogo(targetHeight) {
  const width = Math.round(targetHeight * LOGO_ASPECT);
  return sharp(svgPath, { density: 72 })
    .resize(width, targetHeight)
    .ensureAlpha()
    .png()
    .toBuffer();
}

// Build a square canvas with the logo centered and scaled to `availRatio` of the size.
async function makeCanvas({ size, onPaper = false, availRatio = 0.7 }) {
  const avail = Math.round(size * availRatio);
  const logoH = avail;
  const logoW = Math.round(avail * LOGO_ASPECT);
  // Re-rasterize the logo at exactly the target size for sharpness.
  const logoPng = await rasterLogo(logoH);
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

  // 2. splash-icon.png — 512, transparent, centered, smaller
  const splash = await makeCanvas({
    size: 1024,
    onPaper: false,
    availRatio: 0.56,
  });
  await sharp(splash)
    .resize(512, 512)
    .toFile(path.join(outDir, 'splash-icon.png'));
  console.log('splash-icon.png (512, transparent)');

  // 3. favicon.png — 48, transparent background (blends into the browser tab)
  const favicon = await makeCanvas({
    size: 64,
    onPaper: false,
    availRatio: 0.92,
  });
  await sharp(favicon).resize(48, 48).toFile(path.join(outDir, 'favicon.png'));
  console.log('favicon.png (48, transparent)');

  // 4. android foreground — 1024 transparent, logo in safe zone
  const fg = await makeCanvas({ size: 1024, onPaper: false, availRatio: 0.56 });
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
