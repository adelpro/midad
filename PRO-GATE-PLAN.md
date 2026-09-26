# Pro Entitlement and Watermark Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Pro entitlement and an export watermark that Pro removes, with the
gate shipping **disabled** during early access, plus the device-local seam that
real payments will plug into later.

**Architecture:** Two pure, import-free modules hold the rules (`src/theme/pro.ts`
for the gate, `src/editor/render/watermark.ts` for the mark's box); the brand
mark's vector path moves to a third (`src/theme/brand.ts`) shared with the in-app
logo. A device-local zustand store (`src/storage/entitlement.ts`) holds the
entitlement and is the only thing payments will call. The PNG renderer draws the
mark when asked; the SVG exporter is untouched because SVG is a Pro-only output,
not a watermarked one.

**Tech Stack:** React Native 0.86 / Expo SDK 57, TypeScript strict, zustand +
AsyncStorage, `@shopify/react-native-skia`, the repo's `check-*.mjs` scripts in
place of a test runner.

**Spec:** `docs/superpowers/specs/2026-09-26-pro-gate-design.md`

## Global Constraints

- Expo SDK 57: read the versioned docs (<https://docs.expo.dev/versions/v57.0.0/>)
  before using an API.
- `src/theme/pro.ts`, `src/theme/brand.ts` and `src/editor/render/watermark.ts`
  must declare **no value imports** (`import type` is allowed only where a module
  genuinely needs types; none of these three do). `scripts/check-entitlement.mjs`
  transpiles and evaluates them standalone.
- `PRO_GATE_ENABLED` is **`false`** in this spec. `exportWatermarked(source, gate)`
  is `gate && !isPro(source)`. The gate is read as
  `__DEV__ && devGateOverride != null ? devGateOverride : PRO_GATE_ENABLED`.
- The watermark is drawn on the **PNG export only**. `projectToSvg` gains **no**
  watermark code. The `.midad` export, the canvas, gallery thumbnails and the
  import render stay clean.
- Entitlement is **device-local** (`midad:entitlement:v1`): no project-schema
  bump, nothing for `import-project.ts`.
- Canonical content ink for the mark is `DEFAULT_INK` (`#111111`); the UI theme's
  `ink` is never used in an export.
- There is no test runner. `node scripts/verify.mjs` is the gate; individual
  `check-*.mjs` scripts cover single modules. The suite has **thirteen** checks
  today; this plan adds the fourteenth.
- Format with `yarn format:fix` (prettier), not ad-hoc prettier.
- Commits follow Conventional Commits (`commitlint`).

## Review Focus

The spec implies inputs and states no task's happy path exercises. Each is
watched and tied to the task that owns its code:

1. **Gate off / no entitlement** — the default. Every export must be unmarked and
   the app must behave exactly as today (Task 6's `exportIsWatermarked()` is false
   while `PRO_GATE_ENABLED` is false; Task 1's check pins it).
2. **Export before hydration** — a cold start must not export against the store's
   defaults (Task 7 extends the launch gate; manual pass in Task 10).
3. **Extreme canvas aspect** — a very wide, very tall, or tiny canvas must keep
   the mark fully on-canvas (Task 3's `watermarkBox` check: square, portrait,
   landscape, tiny).
4. **A dev override leaking into a release** — a persisted `devGateOverride` must
   be ignored outside `__DEV__` (Task 5's `entitlementGateEnabled()` guard;
   Task 1's check asserts the guard text).
5. **A regression that marks SVG/PDF/`.midad`** — caught by Task 4's source
   assertion that `export/svg.ts` contains no watermark symbol.

---

### Task 1: Pure gate rules + check script

**Files:**

- Create: `src/theme/pro.ts`
- Create: `scripts/check-entitlement.mjs`
- Modify: `scripts/verify.mjs` (doc comment + task table)
- Modify: `AGENTS.md` (checks wording + command list)

**Interfaces:**

- Produces:
  - `type EntitlementSource = 'none' | 'dev' | 'play' | 'license' | 'founder'`
  - `const PRO_GATE_ENABLED: boolean` (`false`)
  - `isPro(source: EntitlementSource): boolean`
  - `exportWatermarked(source: EntitlementSource, gateEnabled: boolean): boolean`

- [ ] **Step 1: Write the failing check**

Create `scripts/check-entitlement.mjs`:

```js
/**
 * Standalone verification for the Pro entitlement gate and the export watermark.
 *
 * Transpiles the pure modules (none imports anything) and pins the rules the
 * exporters depend on: the source union, the gate flag, the watermark box, the
 * brand transform, and the fact that the SVG exporter carries no watermark.
 *
 * Run: node scripts/check-entitlement.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

let failures = 0;
let cases = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function check(label, got, expected) {
  cases += 1;
  if (got !== expected) {
    fail(
      `${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
    );
  }
}

function load(relPath) {
  const source = readFileSync(join(root, relPath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const shim = { exports: {} };
  new Function('exports', 'module', outputText)(shim.exports, shim);
  return { exports: shim.exports, source };
}

/** A pure module may not contain a value import. */
function hasValueImports(source) {
  return source
    .split('\n')
    .some(
      (line) => /^\s*import\s/.test(line) && !/^\s*import\s+type\s/.test(line),
    );
}

// ── src/theme/pro.ts ────────────────────────────────────────────────────────
const pro = load('src/theme/pro.ts').exports;
const proSource = load('src/theme/pro.ts').source;

check('pro: no value imports', hasValueImports(proSource), false);
check('pro: gate off in early access', pro.PRO_GATE_ENABLED, false);
for (const source of ['dev', 'play', 'license', 'founder']) {
  check(`pro: isPro(${source})`, pro.isPro(source), true);
}
check('pro: isPro(none)', pro.isPro('none'), false);
// The gate is off, so nothing is marked no matter the entitlement.
for (const source of ['none', 'dev', 'play', 'license', 'founder']) {
  check(
    `pro: gate off never marks (${source})`,
    pro.exportWatermarked(source, false),
    false,
  );
}
// With the gate on, only a free source is marked.
check('pro: gate on marks none', pro.exportWatermarked('none', true), true);
for (const source of ['dev', 'play', 'license', 'founder']) {
  check(
    `pro: gate on spares ${source}`,
    pro.exportWatermarked(source, true),
    false,
  );
}

if (failures > 0) {
  console.error(`\ncheck-entitlement: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`check-entitlement: OK (${cases} cases)`);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node scripts/check-entitlement.mjs`
Expected: FAIL — throws `ENOENT` on `src/theme/pro.ts` (the module does not exist
yet).

- [ ] **Step 3: Write the gate rules**

Create `src/theme/pro.ts`:

```ts
/**
 * The Pro gate's rules.
 *
 * Pure and import-free on purpose — `scripts/check-entitlement.mjs` transpiles
 * and evaluates it standalone, the same way the other check scripts treat their
 * subjects, so a value import would silently break that check.
 *
 * `PRO_GATE_ENABLED` is `false` during early access: the watermark code exists,
 * but nothing is marked until the release that also makes the unlock
 * purchasable. See `docs/pro-entitlement.md`.
 */

/** Where an entitlement came from. `none` is the free tier. */
export type EntitlementSource = 'none' | 'dev' | 'play' | 'license' | 'founder';

/** Early access ships the gate OFF — the app behaves as Pro for everyone. */
export const PRO_GATE_ENABLED = false;

/** Whether this entitlement removes the export watermark. */
export function isPro(source: EntitlementSource): boolean {
  return source !== 'none';
}

/**
 * The one decision point the exporters call: is this export marked?
 *
 * While the gate is off nothing is marked, whatever the entitlement; when it is
 * on, only a free source is.
 */
export function exportWatermarked(
  source: EntitlementSource,
  gateEnabled: boolean,
): boolean {
  return gateEnabled && !isPro(source);
}
```

- [ ] **Step 4: Run the check to confirm it passes**

Run: `node scripts/check-entitlement.mjs`
Expected: PASS — `check-entitlement: OK (12 cases)`.

- [ ] **Step 5: Wire it into the suite**

In `scripts/verify.mjs`:

- Change the doc comment's "the thirteen `check-*` scripts" to "the fourteen
  `check-*` scripts".
- Add to `TASKS`, after the `color` entry:

```js
  { id: 'entitlement', command: [join(here, 'check-entitlement.mjs')] },
```

In `AGENTS.md`:

- Change "and all thirteen checks" to "and all fourteen checks".
- Add to the per-script list, after the `check-color.mjs` line:

```bash
node scripts/check-entitlement.mjs # Pro gate rules + watermark box + brand transform
```

- [ ] **Step 6: Run the full suite**

Run: `node scripts/verify.mjs`
Expected: PASS, with an `entitlement - PASS` section.

- [ ] **Step 7: Commit**

```bash
git add src/theme/pro.ts scripts/check-entitlement.mjs scripts/verify.mjs AGENTS.md
git commit -m "feat(pro): pure Pro gate rules with a standalone check"
```

---

### Task 2: Extract the brand mark path

**Files:**

- Create: `src/theme/brand.ts`
- Modify: `src/components/ui/brand-mark.tsx`
- Modify: `scripts/check-entitlement.mjs` (extend)

**Interfaces:**

- Produces:
  - `const BRAND_PATH_D: string`
  - `const BRAND_VIEW_BOX: { x: number; y: number; width: number; height: number }`
  - `const BRAND_ASPECT: number`
  - `brandPathTransform(box: { x: number; y: number; width: number; height: number }): { scale: number; translateX: number; translateY: number }`
- Consumes: nothing.

- [ ] **Step 1: Extend the failing check**

In `scripts/check-entitlement.mjs`, immediately after the `pro` block, add:

```js
// ── src/theme/brand.ts ──────────────────────────────────────────────────────
const brandMod = load('src/theme/brand.ts');
const brand = brandMod.exports;

check('brand: no value imports', hasValueImports(brandMod.source), false);
check('brand: viewBox width', brand.BRAND_VIEW_BOX.width, 412);
check('brand: viewBox height', brand.BRAND_VIEW_BOX.height, 743);
check('brand: path is present', typeof brand.BRAND_PATH_D, 'string');
check(
  'brand: path is a move command',
  brand.BRAND_PATH_D.startsWith('M'),
  true,
);

// Aspect-fit into an exactly-proportional box: scale is height-driven, no centring.
const fit = brand.brandPathTransform({
  x: 100,
  y: 50,
  width: 206,
  height: 371.5,
});
check('brand: fit scale', fit.scale, 0.5);
check('brand: fit translateX', fit.translateX, 100 - 196 * 0.5);
check('brand: fit translateY', fit.translateY, 50 - 107 * 0.5);

// A box wider than the mark centres horizontally instead of stretching.
const wide = brand.brandPathTransform({ x: 0, y: 0, width: 1000, height: 743 });
check('brand: aspect preserved in a wide box', wide.scale, 1);
check('brand: wide box centres', wide.translateX, (1000 - 412) / 2 - 196);
check('brand: wide box baseline', wide.translateY, -107);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node scripts/check-entitlement.mjs`
Expected: FAIL — throws `ENOENT` on `src/theme/brand.ts`.

- [ ] **Step 3: Create the brand module**

In `src/components/ui/brand-mark.tsx`, **cut** the existing
`const D = \`…\`;`declaration (the long path string) and the`VIEW_W`/`VIEW_H`constants. Paste the path into a new`src/theme/brand.ts`, verbatim, as
`BRAND_PATH_D`, and write the rest of the module:

```ts
/**
 * The midad calligraphic mark's geometry — the one source shared by the in-app
 * logo (`components/ui/brand-mark.tsx`) and the export watermark
 * (`editor/render/watermark.ts`), so the two can never diverge.
 *
 * Pure and import-free on purpose — `scripts/check-entitlement.mjs` transpiles
 * and evaluates it standalone.
 */

/** The mark's SVG path, in the units of `BRAND_VIEW_BOX`. */
// Paste the path string that was `const D` in `brand-mark.tsx` here, verbatim.
export const BRAND_PATH_D = `M 574.15 158.99 …`;

/** The source artboard the path is authored in (the old `VIEW_*`, plus origin). */
export const BRAND_VIEW_BOX = { x: 196, y: 107, width: 412, height: 743 };

/** The mark's width ÷ height, so a caller can size a box without the path. */
export const BRAND_ASPECT = BRAND_VIEW_BOX.width / BRAND_VIEW_BOX.height;

/**
 * The transform that maps the path from `BRAND_VIEW_BOX` units into `box`,
 * preserving aspect ratio (aspect-fit) and centring the slack. Apply it as
 * `translate(translateX, translateY) scale(scale)` before drawing the path.
 */
export function brandPathTransform(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { scale: number; translateX: number; translateY: number } {
  const scale = Math.min(
    box.width / BRAND_VIEW_BOX.width,
    box.height / BRAND_VIEW_BOX.height,
  );
  const drawnWidth = BRAND_VIEW_BOX.width * scale;
  const drawnHeight = BRAND_VIEW_BOX.height * scale;
  return {
    scale,
    translateX: box.x + (box.width - drawnWidth) / 2 - BRAND_VIEW_BOX.x * scale,
    translateY:
      box.y + (box.height - drawnHeight) / 2 - BRAND_VIEW_BOX.y * scale,
  };
}
```

> The `const D` path is long and must be moved **verbatim** — do not retype or
> reformat it. The `…` above is the elision of that existing string, nothing more.

- [ ] **Step 4: Point `BrandMark` at the shared module**

Replace the constants and the `<Svg>` in `src/components/ui/brand-mark.tsx`:

```tsx
import { Path, Svg } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { BRAND_PATH_D, BRAND_VIEW_BOX, BRAND_ASPECT } from '@/theme/brand';

export interface BrandMarkProps {
  /** Rendered height in dp; width follows the source aspect ratio. */
  height?: number;
  /** Defaults to the theme ink color (adapts to dark mode). */
  color?: string;
}

export function BrandMark({ height = 32, color }: BrandMarkProps) {
  const { colors: c } = useTheme();
  const width = height * BRAND_ASPECT;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`${BRAND_VIEW_BOX.x} ${BRAND_VIEW_BOX.y} ${BRAND_VIEW_BOX.width} ${BRAND_VIEW_BOX.height}`}
      accessibilityLabel="midad"
    >
      <Path
        d={BRAND_PATH_D}
        fill={color ?? c.ink}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </Svg>
  );
}
```

`width = height * BRAND_ASPECT` equals the old
`(height * VIEW_W) / VIEW_H` exactly, and the `viewBox` string is unchanged.

- [ ] **Step 5: Run the check and the typecheck**

Run: `node scripts/check-entitlement.mjs && npx tsc --noEmit`
Expected: PASS — `check-entitlement: OK (` more than before `cases)`, and no type
errors.

- [ ] **Step 6: Commit**

```bash
git add src/theme/brand.ts src/components/ui/brand-mark.tsx scripts/check-entitlement.mjs
git commit -m "refactor(brand): share the mark path between the logo and the exporter"
```

---

### Task 3: Pure watermark box

**Files:**

- Create: `src/editor/render/watermark.ts`
- Modify: `scripts/check-entitlement.mjs` (extend)

**Interfaces:**

- Produces:
  - `const WATERMARK_OPACITY: number` (`0.32`)
  - `watermarkBox(canvasWidth: number, canvasHeight: number, aspect: number): { x: number; y: number; width: number; height: number; opacity: number }`
- Consumes: nothing (the aspect is passed in, so the module stays import-free).

- [ ] **Step 1: Extend the failing check**

In `scripts/check-entitlement.mjs`, after the `brand` block, add:

```js
// ── src/editor/render/watermark.ts ──────────────────────────────────────────
const wmMod = load('src/editor/render/watermark.ts');
const wm = wmMod.exports;
const ASPECT = brand.BRAND_ASPECT;

check('watermark: no value imports', hasValueImports(wmMod.source), false);
check('watermark: opacity', wm.WATERMARK_OPACITY, 0.32);

function anchor(label, W, H) {
  const box = wm.watermarkBox(W, H, ASPECT);
  const min = Math.min(W, H);
  const height = Math.round(min * 0.08);
  const width = Math.round(height * ASPECT);
  const margin = Math.round(min * 0.04);
  check(`${label}: height`, box.height, height);
  check(`${label}: width`, box.width, width);
  check(`${label}: fully on canvas (x)`, box.x >= 0, true);
  check(`${label}: fully on canvas (y)`, box.y >= 0, true);
  check(`${label}: right edge inset`, box.x + box.width <= W, true);
  check(`${label}: bottom edge inset`, box.y + box.height <= H, true);
  check(`${label}: bottom-right x`, box.x, W - margin - width);
  check(`${label}: bottom-right y`, box.y, H - margin - height);
  check(`${label}: opacity carried`, box.opacity, wm.WATERMARK_OPACITY);
  // Determinism.
  const again = wm.watermarkBox(W, H, ASPECT);
  check(`${label}: deterministic`, JSON.stringify(box), JSON.stringify(again));
}

anchor('square', 1080, 1080);
anchor('portrait', 1080, 1620);
anchor('landscape', 1620, 1080);
anchor('story', 1080, 1920);
anchor('tiny', 64, 64);
anchor('wide banner', 2400, 400);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node scripts/check-entitlement.mjs`
Expected: FAIL — throws `ENOENT` on `src/editor/render/watermark.ts`.

- [ ] **Step 3: Write the module**

Create `src/editor/render/watermark.ts`:

```ts
/**
 * The export watermark's geometry — one pure module, so the Skia PNG renderer
 * and any future renderer agree to the design unit.
 *
 * Pure and import-free on purpose — `scripts/check-entitlement.mjs` transpiles
 * and evaluates it standalone. The brand's aspect ratio is passed in by the
 * caller (`BRAND_ASPECT` from `theme/brand.ts`) rather than imported, so this
 * module keeps that property.
 */

/** The mark's fixed opacity. Legibility on same-coloured art is a known limit. */
export const WATERMARK_OPACITY = 0.32;

/** Fraction of the canvas's short side given to the mark's height. */
const HEIGHT_FRACTION = 0.08;
/** Fraction of the canvas's short side left as the corner margin. */
const MARGIN_FRACTION = 0.04;

/**
 * The mark's box in **design units**, anchored to the physical bottom-right
 * corner so an export looks identical whichever language the app is in.
 */
export function watermarkBox(
  canvasWidth: number,
  canvasHeight: number,
  aspect: number,
): { x: number; y: number; width: number; height: number; opacity: number } {
  const min = Math.min(canvasWidth, canvasHeight);
  const height = Math.round(min * HEIGHT_FRACTION);
  const width = Math.round(height * aspect);
  const margin = Math.round(min * MARGIN_FRACTION);
  return {
    x: canvasWidth - margin - width,
    y: canvasHeight - margin - height,
    width,
    height,
    opacity: WATERMARK_OPACITY,
  };
}
```

- [ ] **Step 4: Run the check**

Run: `node scripts/check-entitlement.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/render/watermark.ts scripts/check-entitlement.mjs
git commit -m "feat(editor): pure export-watermark geometry"
```

---

### Task 4: Draw the watermark in the PNG renderer

**Files:**

- Modify: `src/editor/render/offscreen.ts`
- Modify: `scripts/check-entitlement.mjs` (extend with source assertions)

**Interfaces:**

- Consumes: `BRAND_PATH_D`, `BRAND_ASPECT`, `brandPathTransform` (Task 2);
  `watermarkBox` (Task 3); `DEFAULT_INK` from `@/theme/content-palette`.
- Produces: `OffscreenRenderOptions.watermark?: boolean` on
  `renderProjectToPng`.

- [ ] **Step 1: Extend the check with source assertions**

In `scripts/check-entitlement.mjs`, before the failure report, add:

```js
// ── wiring assertions ───────────────────────────────────────────────────────
const offscreen = readFileSync(
  join(root, 'src', 'editor', 'render', 'offscreen.ts'),
  'utf8',
);
const svg = readFileSync(
  join(root, 'src', 'editor', 'export', 'svg.ts'),
  'utf8',
);

check(
  'offscreen: accepts a watermark option',
  /watermark\?: boolean/.test(offscreen),
  true,
);
check(
  'offscreen: draws the brand path',
  offscreen.includes('BRAND_PATH_D'),
  true,
);
check(
  'offscreen: uses the watermark box',
  offscreen.includes('watermarkBox'),
  true,
);
// SVG is a Pro-only output, not a watermarked one: no watermark code may appear.
check('svg: has no watermark code', /watermark/i.test(svg), false);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node scripts/check-entitlement.mjs`
Expected: FAIL — `offscreen: accepts a watermark option` (and the SVG assertion
passes, since `svg.ts` has no watermark today).

- [ ] **Step 3: Add the option and the draw**

In `src/editor/render/offscreen.ts`, add the imports:

```ts
import { watermarkBox } from '@/editor/render/watermark';
import { BRAND_ASPECT, BRAND_PATH_D, brandPathTransform } from '@/theme/brand';
import { DEFAULT_INK } from '@/theme/content-palette';
```

Add the option to the interface:

```ts
export interface OffscreenRenderOptions {
  /** Target size of the longest canvas side in pixels. Default 2048. */
  maxWidthPx?: number;
  /** Draw the brand watermark (a free-tier export). Default false. */
  watermark?: boolean;
}
```

After the object loop's closing `c.restore();` — the point where the canvas is
back in device-pixel space and every object is drawn — and before
`surface.flush();`, add:

```ts
// Export watermark. Drawn last, in design units, so it sits over every object
// and matches the design on any target resolution. PNG only — SVG is a
// Pro-only output, not a watermarked one (docs/pro-entitlement.md).
if (options?.watermark) {
  const box = watermarkBox(W, H, BRAND_ASPECT);
  const path = Skia.Path.MakeFromSVGString(BRAND_PATH_D);
  if (path) {
    const t = brandPathTransform(box);
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(DEFAULT_INK));
    paint.setAlphaf(box.opacity);
    c.save();
    c.scale(s, s);
    c.translate(t.translateX, t.translateY);
    c.scale(t.scale, t.scale);
    c.drawPath(path, paint);
    c.restore();
  }
}
```

`watermarkBox` already carries the opacity in its returned box, so no opacity
constant is imported here.

- [ ] **Step 4: Run the check, typecheck and lint**

Run: `node scripts/check-entitlement.mjs && npx tsc --noEmit && npx eslint src/editor/render/offscreen.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/render/offscreen.ts scripts/check-entitlement.mjs
git commit -m "feat(editor): draw the export watermark in the PNG renderer"
```

---

### Task 5: Entitlement store and the gate readers

**Files:**

- Create: `src/storage/entitlement.ts`
- Modify: `scripts/check-entitlement.mjs` (extend with store assertions)

**Interfaces:**

- Consumes: `PRO_GATE_ENABLED`, `exportWatermarked`, `type EntitlementSource`
  (Task 1).
- Produces:
  - `interface EntitlementState`
  - `useEntitlement` — the zustand store
  - `entitlementGateEnabled(): boolean`
  - `exportIsWatermarked(): boolean`

- [ ] **Step 1: Extend the check**

In `scripts/check-entitlement.mjs`, before the failure report, add:

```js
// ── src/storage/entitlement.ts ──────────────────────────────────────────────
const ent = readFileSync(
  join(root, 'src', 'storage', 'entitlement.ts'),
  'utf8',
);
check('entitlement: persist key', ent.includes('midad:entitlement:v1'), true);
check('entitlement: grants through grantPro', ent.includes('grantPro'), true);
check(
  'entitlement: exposes the export reader',
  ent.includes('exportIsWatermarked'),
  true,
);
check(
  'entitlement: dev override is __DEV__-guarded',
  /__DEV__\s*&&[\s\S]*devGateOverride/.test(ent),
  true,
);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node scripts/check-entitlement.mjs`
Expected: FAIL — `ENOENT` on `src/storage/entitlement.ts`.

- [ ] **Step 3: Write the store**

Create `src/storage/entitlement.ts`:

```ts
/**
 * The device-local Pro entitlement — the seam real payments will call.
 *
 * Device-local like `selectionBarActions` and the font pins: it never enters the
 * project document, so there is no schema bump and nothing for
 * `import-project.ts` to validate. The cost is that a purchase does not travel
 * in an exported `.midad`, which is the intended trade.
 *
 * This store is *not* a security boundary. The gate is client-side deterrence
 * (docs/pro-entitlement.md §8); server-side receipt validation arrives with the
 * purchase flow in a later spec.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  PRO_GATE_ENABLED,
  exportWatermarked,
  type EntitlementSource,
} from '@/theme/pro';

export interface EntitlementState {
  /** Derived at every write: `pro === (source !== 'none')`. */
  pro: boolean;
  source: EntitlementSource;
  /** Set only by a verified purchase/licence; `null` for free and dev grants. */
  licenseKey: string | null;
  /**
   * Dev-only QA override of `PRO_GATE_ENABLED`; `null` means "use the constant".
   * Persisted, but ignored outside `__DEV__` by `entitlementGateEnabled`.
   */
  devGateOverride: boolean | null;
  /** The only way Pro is granted. A verified purchase calls this. */
  grantPro: (
    source: Exclude<EntitlementSource, 'none'>,
    licenseKey?: string,
  ) => void;
  revokePro: () => void;
  /** Dev builds only: force the gate on so the watermark is testable. */
  setDevGateOverride: (value: boolean | null) => void;
}

export const useEntitlement = create<EntitlementState>()(
  persist(
    (set) => ({
      pro: false,
      source: 'none',
      licenseKey: null,
      devGateOverride: null,
      grantPro: (source, licenseKey) =>
        set({ pro: true, source, licenseKey: licenseKey ?? null }),
      revokePro: () => set({ pro: false, source: 'none', licenseKey: null }),
      setDevGateOverride: (devGateOverride) => set({ devGateOverride }),
    }),
    {
      name: 'midad:entitlement:v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * Whether the gate is active right now. A persisted dev override from a dev
 * build is ignored in a release build.
 */
export function entitlementGateEnabled(): boolean {
  const { devGateOverride } = useEntitlement.getState();
  return __DEV__ && devGateOverride != null
    ? devGateOverride
    : PRO_GATE_ENABLED;
}

/** The one call the export paths make: is this export watermarked? */
export function exportIsWatermarked(): boolean {
  const { source } = useEntitlement.getState();
  return exportWatermarked(source, entitlementGateEnabled());
}
```

- [ ] **Step 4: Run the check, typecheck and lint**

Run: `node scripts/check-entitlement.mjs && npx tsc --noEmit && npx eslint src/storage/entitlement.ts`
Expected: PASS. If `__DEV__` is not typed, `expo-env.d.ts` already declares it;
if eslint flags it as undefined, add it to the globals in `eslint.config.js`
alongside the existing ones.

- [ ] **Step 5: Commit**

```bash
git add src/storage/entitlement.ts scripts/check-entitlement.mjs
git commit -m "feat(pro): device-local entitlement store and export readers"
```

---

### Task 6: Wire the export paths

**Files:**

- Modify: `src/editor/EditorScreen.tsx`

**Interfaces:**

- Consumes: `exportIsWatermarked` (Task 5).

- [ ] **Step 1: Import the reader**

Add beside the other `@/storage` imports:

```ts
import { exportIsWatermarked } from '@/storage/entitlement';
```

- [ ] **Step 2: Mark the two image exports only**

In `exportImage`, change the render call:

```ts
const png = renderProjectToPng(live, skiaFonts, {
  maxWidthPx: 2048,
  watermark: exportIsWatermarked(),
});
```

In `exportSaveToPhotos`, change the render call the same way:

```ts
const png = renderProjectToPng(live, skiaFonts, {
  maxWidthPx: 2048,
  watermark: exportIsWatermarked(),
});
```

**Leave `save()` unchanged** — its thumbnail render takes no `watermark` option,
so a thumbnail is never marked. **Leave `exportSvg` and `exportFile` unchanged** —
SVG is a Pro-only output (later spec) and `.midad` is the editable source; neither
is watermarked.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/editor/EditorScreen.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/editor/EditorScreen.tsx
git commit -m "feat(editor): watermark the free PNG exports"
```

---

### Task 7: Hold the launch gate for entitlement hydration

**Files:**

- Modify: `src/hooks/use-bootstrap.ts`

**Interfaces:**

- Consumes: `useEntitlement` (Task 5).

- [ ] **Step 1: Generalise the hydration hook**

In `src/hooks/use-bootstrap.ts`, replace `useSettingsHydrated` with a generic
helper and add the entitlement read. Replace the import block's settings line and
the hook:

```ts
import { useEntitlement } from '@/storage/entitlement';
import { useSettings } from '@/storage/settings';
```

```ts
/** The smallest shape `persist` exposes that this hook needs. */
interface HydratableStore {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
}

/**
 * Whether a persisted store has finished rehydrating.
 *
 * `persist` reads AsyncStorage asynchronously, so the very first render sees the
 * store's defaults. Any decision that depends on a *stored* preference — the
 * onboarding gate in `app/index.tsx`, or the Pro entitlement the export watermark
 * reads — would then be made against defaults. Holding the splash until
 * hydration lands closes that window instead of papering over it with a
 * post-mount redirect.
 */
function usePersistHydrated(store: HydratableStore): boolean {
  const [hydrated, setHydrated] = useState(() => store.persist.hasHydrated());

  useEffect(() => {
    if (store.persist.hasHydrated()) {
      // Hydration landed between the first render and this effect. That is the
      // common case, not the exotic one — the storage read starts when the store
      // module is first evaluated, before React has finished rendering — so
      // leaning on the subscription alone would add the whole grace period to
      // every warm start.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot reconciliation with an external store that already settled
      setHydrated(true);
      return;
    }

    // A storage read that never settles must not hold the splash forever: after
    // the grace period the store's defaults are used instead.
    const timer = setTimeout(() => setHydrated(true), HYDRATION_GRACE_MS);
    const unsubscribe = store.persist.onFinishHydration(() => {
      clearTimeout(timer);
      setHydrated(true);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [store]);

  return hydrated;
}
```

- [ ] **Step 2: Combine both stores in `useBootstrap`**

```ts
export function useBootstrap() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const settingsHydrated = usePersistHydrated(useSettings);
  const entitlementHydrated = usePersistHydrated(useEntitlement);

  useEffect(() => {
    if ((fontsLoaded || fontError) && settingsHydrated && entitlementHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, settingsHydrated, entitlementHydrated]);

  return {
    ready:
      !!fontsLoaded && !fontError && settingsHydrated && entitlementHydrated,
    // Withheld until hydration, so a font error cannot let the root layout
    // render past the gate on defaults.
    error: settingsHydrated && entitlementHydrated ? (fontError ?? null) : null,
  };
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/use-bootstrap.ts`
Expected: PASS. If the `HydratableStore` structural type rejects the zustand
persist object, loosen it to accept the extra members with an index signature on
`persist`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-bootstrap.ts
git commit -m "fix(pro): hold the splash until the entitlement store hydrates"
```

---

### Task 8: Dev-only unlock in Settings

**Files:**

- Modify: `src/app/(tabs)/settings.tsx`

**Interfaces:**

- Consumes: `useEntitlement` (Task 5).

- [ ] **Step 1: Import the store**

Add beside the other `@/storage` imports:

```ts
import { useEntitlement } from '@/storage/entitlement';
```

- [ ] **Step 2: Add the dev block**

Inside `SettingsScreen`, near the other store reads:

```ts
const proSource = useEntitlement((s) => s.source);
const devGateOverride = useEntitlement((s) => s.devGateOverride);
const grantPro = useEntitlement((s) => s.grantPro);
const revokePro = useEntitlement((s) => s.revokePro);
const setDevGateOverride = useEntitlement((s) => s.setDevGateOverride);
```

Then, immediately before the closing `</ScrollView>`, add a dev-only block. Its
labels are literals because it can never ship:

```tsx
{
  __DEV__ && (
    <>
      <SectionLabel>Pro (dev)</SectionLabel>
      <View
        style={[
          styles.row,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Text style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.ink }]}>
          {`source: ${proSource}`}
        </Text>
        <Text
          style={[styles.settingHint, { fontFamily: fonts.ui, color: c.muted }]}
        >
          {devGateOverride == null
            ? 'gate: default (off)'
            : `gate override: ${devGateOverride}`}
        </Text>
        <View style={styles.choiceRow}>
          <Button
            label="Grant dev Pro"
            variant="secondary"
            onPress={() => grantPro('dev')}
            style={styles.choiceBtn}
          />
          <Button
            label="Revoke"
            variant="secondary"
            onPress={revokePro}
            style={styles.choiceBtn}
          />
          <Button
            label="Gate on"
            variant="secondary"
            onPress={() => setDevGateOverride(true)}
            style={styles.choiceBtn}
          />
          <Button
            label="Gate off"
            variant="secondary"
            onPress={() => setDevGateOverride(false)}
            style={styles.choiceBtn}
          />
          <Button
            label="Gate default"
            variant="secondary"
            onPress={() => setDevGateOverride(null)}
            style={styles.choiceBtn}
          />
        </View>
      </View>
    </>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint "src/app/(tabs)/settings.tsx"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/settings.tsx"
git commit -m "chore(pro): dev-only entitlement and gate controls in settings"
```

---

### Task 9: Docs

**Files:**

- Create: `docs/pro-entitlement.md`
- Modify: `docs/editor-render-contract.md`
- Modify: `docs/index.md`
- Modify: `AGENTS.md` (contract table)

- [ ] **Step 1: Write the contract**

Create `docs/pro-entitlement.md` following the folder conventions (title; a
wrapped blockquote preamble naming what it owns and closing with the
fix-the-code clause; `---`; numbered `## N.` sections; a closing `## N. Code
map`). It must record:

- The single gate: free = full editor + watermarked PNG + `.midad`; Pro = clean
  PNG + SVG/PDF + Google Fonts. SVG is Pro-only because an editable SVG
  watermark is not a gate.
- The seam: `useEntitlement` under `midad:entitlement:v1`, `grantPro`/`revokePro`;
  payments call only these.
- `PRO_GATE_ENABLED` is `false` in early access; the gate is read as
  `__DEV__ && devGateOverride != null ? devGateOverride : PRO_GATE_ENABLED`.
- The watermark is PNG-only, drawn from `theme/brand.ts`, never the canvas,
  thumbnails or `.midad`; hydration is held by `use-bootstrap.ts`.
- The trust model: client-side deterrence, not security; web is the weakest
  surface; server-side receipt validation is a later spec.

- [ ] **Step 2: Note the render-contract line**

In `docs/editor-render-contract.md`, add to the export section: the watermark is
an export-only overlay drawn from the shared brand geometry in the PNG path only,
never part of the document, and deliberately absent from the SVG exporter.

- [ ] **Step 3: Index and agent tables**

- `docs/index.md`: add a row for `pro-entitlement.md` with its code map and
  `check-entitlement.mjs`, and add `theme/brand.ts` where `brand-mark.tsx` is
  covered.
- `AGENTS.md`: add to the contract table —
  `` `storage/entitlement.ts`, `theme/pro.ts`, `theme/brand.ts`, the export watermark `` |
  `docs/pro-entitlement.md`.

- [ ] **Step 4: Format and commit**

```bash
yarn format:fix
git add docs/pro-entitlement.md docs/editor-render-contract.md docs/index.md AGENTS.md
git commit -m "docs(pro): entitlement and watermark gate contract"
```

---

### Task 10: Full verification and manual pass

- [ ] **Step 1: Run the suite**

Run: `node scripts/verify.mjs`
Expected: PASS — `typecheck`, `lint`, `format`, and all fourteen `check-*` tasks
green.

- [ ] **Step 2: Manual pass (web is fastest)**

With `yarn web`, and `__DEV__` on:

1. Settings shows the Pro (dev) block; `source: none`, `gate: default (off)`.
2. Export PNG in the editor → **no watermark** (gate off).
3. Settings → **Gate on** → export PNG → the mark sits bottom-right, matching the
   in-app `BrandMark` in shape.
4. The canvas and the gallery thumbnail are **not** marked.
5. Export `.midad` and Save to Photos → `.midad` unmarked; Save to Photos marked
   (it is a PNG).
6. Settings → **Grant dev Pro** → export PNG → clean.
7. Settings → **Revoke** + **Gate on** → marked again.
8. Settings → **Gate off** → clean regardless of entitlement.
9. Reload the app → the dev choices persist; set language to Arabic → the mark is
   still bottom-right.

- [ ] **Step 3: Native smoke (one build)**

Run: `yarn android` (or `yarn ios`), repeat steps 3 and 6 to confirm the Skia
path draws the mark identically to the web CanvasKit path.

- [ ] **Step 4: Final commit if anything changed**

```bash
git add -A
git commit -m "test(pro): verification pass for the entitlement gate"
```
