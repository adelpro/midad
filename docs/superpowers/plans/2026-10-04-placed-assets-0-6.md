# Placed assets 0.6.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 0.6.0 — a placed raster image object, an imported Iconify icon object, the `.midad` v3 container that holds them, and the first reader for a version-2 document so nothing already on a device disappears.

**Architecture:** The document grows two object kinds and a named asset entry per object. The version-2 reader is one pure function used by all three load paths, so the rule is stated once. Icons are resolved at insert time from the Iconify API into plain path geometry (`d` + `fill-rule`) and stored in the document, so rendering and export use only the core Skia Path API on both native and CanvasKit web — no SVG module, no network on load. Storage stays platform-split behind one declared API, with a sweep on save so replacing or deleting an object never leaks bytes and undo/redo stays safe.

**Tech Stack:** Expo SDK 57, react-native-skia 2.6, `fflate` (the `.midad` ZIP), `expo-file-system` (native store), AsyncStorage (web store), `expo-image-picker`, zustand.

**Spec:** `docs/superpowers/specs/2026-10-04-placed-assets-0-6-design.md`

## Global Constraints

- **Both versions must load.** `normalizeProjectVersion` accepts `2` and `3` and is the only place that decides. It is called by `design-file.ts` (`unpackDesign`), `projects.native.ts` (`loadProject`) and `projects.web.ts` (`loadProject`). Never duplicate its condition.
- **A new object kind is one move across three renderers.** `EditorCanvas.tsx`, `render/offscreen.ts` and `export/svg.ts` must agree; in `offscreen.ts` and `svg.ts` the final `else` is the glyph branch, so a new kind is an explicit branch, never an appended `else`. `docs/editor-render-contract.md` §2 is the law here.
- `src/i18n/strings.ts` declares no imports; every new key goes in the `Translation` interface and in both language blocks.
- `src/theme/icon-sets.ts` and `src/editor/icons/icon-geometry.ts` are transpiled and evaluated standalone by `scripts/check-icons.mjs`, so they may declare **only `import type`** or no imports at all.
- A new selection-bar action is a `selection-actions.tsx` table entry **plus** a `sel.<id>` entry in `src/editor/help/catalog.ts` plus strings, then `check-help.mjs` and `check-shortcuts.mjs` (`docs/index.md` §5).
- No new runtime dependency. `@iconify/utils` was considered and rejected (its parsed form is still markup); do not add it.
- Image entries are stored in the ZIP at `level: 0` (JPEG/PNG are already compressed); `design.json` stays DEFLATE. This is an established decision, not a preference.
- Verification commands: `node scripts/verify.mjs` (sixteen tasks; seventeen once `check-icons.mjs` is registered), `npx tsc --noEmit`, `yarn format:fix`.
- **There is no test runner.** "Verify" means the named check script, the compiler, or the named platform observation.
- Task D2 touches `staging` and `main` and pushes tags. **Do not run it without an explicit go-ahead.**

## Review Focus

Five conditions the design implies but no check script can exercise. Each is pinned to a task below.

1. **A design created before this change.** It has `version: 2` on disk. It must still appear in the gallery and still open, with its background intact — the reader is what prevents the version bump from hiding the user's own work.
2. **Undo of a delete, and of an image replace.** The save-time sweep must not have removed bytes an undone object still needs. An undone delete is an object that is present again, so its file must survive.
3. **A two-image export/import round trip.** Both objects must come back at their positions, including through the gallery's duplicate path, which copies bytes separately from the import path.
4. **An icon search that fails.** Offline, or with the API unreachable, the icon block must show a visible failure and leave the Image block usable — no crash, no spinner that never ends.
5. **A palette-set or non-path icon.** It must be refused visibly (a disabled row with a reason), never inserted as an empty object with no geometry.

---

## Phase A — The version-2 reader, and the container that can hold assets

### Task A1: Add the version-2 reader and move the document to version 3

**Files:**
- Modify: `src/storage/project-schema.ts:12` (`PROJECT_FILE_VERSION`)
- Modify: `src/storage/project-schema.ts` (add `normalizeProjectVersion`)
- Modify: `src/storage/design-file.ts:110-133` (`unpackDesign`'s version check)
- Modify: `src/storage/projects.native.ts:112-125` (`loadProject`)
- Modify: `src/storage/projects.web.ts:70-82` (`loadProject`)

**Interfaces:**
- Produces:
  ```ts
  export const PROJECT_FILE_VERSION = 3;
  /** The only place the accepted-version rule lives. Returns null for an unknown
   *  version or a document with no canvas background; returns version 3 otherwise. */
  export function normalizeProjectVersion(project: unknown): MidadProject | null;
  ```
- Consumes: nothing.
- Consumed by: every load path in Phase A and B.

- [ ] **Step 1: Write the failing observation**

Create a design in the current build, then change `PROJECT_FILE_VERSION` to `3` without adding a reader and reload the gallery on web. Expected (and the bug this task removes): the design vanishes from the gallery, because `loadProject` returns `null`.

- [ ] **Step 2: Add the constant and the normalizer**

In `project-schema.ts`, set `PROJECT_FILE_VERSION = 3` and add `normalizeProjectVersion` beside it. It must:
- reject anything that is not an object, or whose `version` is not `2` or `3`, or that has no `canvas?.background` → `null`;
- return `{ ...project, version: 3 }` otherwise.

A v2 document cannot contain the new object kinds, so nothing else is rewritten. Put that sentence in the doc comment: it is why this reader is three lines.

- [ ] **Step 3: Use it at all three call sites**

Replace the inline `project?.version !== PROJECT_FILE_VERSION || !project.canvas?.background` checks with a call to `normalizeProjectVersion`, and use its return value (a `null` keeps the existing not-found behaviour). Then delete the now-unused import of `PROJECT_FILE_VERSION` from each file if nothing else needs it.

- [ ] **Step 4: Verify the reader**

Run: `npx tsc --noEmit` (expect clean) and `node scripts/verify.mjs` (expect 16 tasks, exit 0).

- [ ] **Step 5: Verify Review Focus 1 on both platforms**

Web: reload the gallery — the design created in Step 1 is listed and opens with its background. Native: install the build over the previous one (do not `pm clear`) and open the same design. Both must show the background.

- [ ] **Step 6: Commit**

```bash
git add src/storage/project-schema.ts src/storage/design-file.ts src/storage/projects.native.ts src/storage/projects.web.ts
git commit -m "feat(storage): read a version-2 document and write version 3"
```

### Task A2: Per-object asset entries, per-asset storage, and the save sweep

**Files:**
- Modify: `src/storage/design-file.ts` (`imageEntryName`, add `assetEntryName`, `packDesign`, `unpackDesign`, `toPersisted`)
- Modify: `src/storage/projects.ts` (declare the two new functions)
- Modify: `src/storage/projects.native.ts` (`writeAssetBytes`, `readAssetBytes`, the attach loop, the sweep)
- Modify: `src/storage/projects.web.ts` (`writeAssetBytes`, `readAssetBytes`, `deleteProject`, the sweep)
- Modify: `src/storage/project-io.ts` (`exportProjectFile` signature)

**Interfaces:**
- Produces:
  ```ts
  export interface DesignAsset { name: string; bytes: Uint8Array; mime: string }
  export function assetEntryName(objectId: string, mime: string): string; // assets/<id>.<ext>
  export function packDesign(project: MidadProject, background: ImagePayload | null, assets: DesignAsset[]): Uint8Array;
  export function unpackDesign(data: Uint8Array): { project: MidadProject; image: ImagePayload | null; assets: DesignAsset[] } | null;
  export declare function writeAssetBytes(id: string, objectId: string, bytes: Uint8Array, mime: string): Promise<StoredImage>;
  export declare function readAssetBytes(id: string, imageFile: string): Promise<Uint8Array | null>;
  ```
- Consumes: `normalizeProjectVersion` (A1), `EXT_BY_MIME`, `imageEntryName`, `sniffImageMime`, `base64ToBytes`.
- Consumed by: Tasks B1, B2, D1.

- [ ] **Step 1: Rename the singular to a list, keeping the background's name**

`imageEntryName` keeps returning `background.<ext>` and stays the background's entry. Add `assetEntryName(objectId, mime)` returning `assets/<objectId>.<ext>`, sharing `EXT_BY_MIME`. `packDesign` takes the background payload **and** an array; `unpackDesign` returns the background as `image` and every `assets/` entry as `assets[]`. Entries are written at `level: 0`.

- [ ] **Step 2: Verify the container did not regress**

Export a design that has only a background image, then import it. Expected: the background survives and `imageFile` still matches `background.<ext>`. This is the regression the entry-name split could break.

- [ ] **Step 3: Strip per-object data URIs**

`toPersisted` currently strips only `canvas.background.imageUri`. Extend it to strip `imageUri` from every object whose `type === 'image'`. This is the same rule as the background's and for the same reason (`docs/storage-format.md`: a leaked data URI inlines multi-megabyte strings into `design.json`).

- [ ] **Step 4: Add the per-asset storage API and implement both platforms**

Native: write `img_<objectId>.<ext>` in the design's directory; delete any `img_<objectId>.*` first (the extension can change with the MIME); `readAssetBytes` reads a named file. Web: one AsyncStorage key per object, `midad-projects:<id>:img:<objectId>`; `readAssetBytes` reads by `imageFile`'s stem.

- [ ] **Step 5: Rebuild every object's `imageUri` on load**

`attachImageUri` (native) and `loadProject` (web) currently rebuild only the background's URI. Add the loop over objects: for each `type === 'image'` whose stored file exists, set `imageUri` from the bytes. A missing file leaves the object without a URI — the renderer must degrade, not throw (Step 4 of Task B1).

- [ ] **Step 6: Sweep orphans on save**

In both `saveProject`s, after writing the document: native lists the design directory and deletes every `img_*` file whose object id is not in `project.objects`; web removes every `:img:` key for that design whose object id is absent. One place, so undo/redo is safe by construction — an undone delete is a present object, so nothing is swept.

- [ ] **Step 7: Update the web delete path**

`deleteProject` removes `designKey` and `backgroundKey`; it must also remove every `:img:` key for that design.

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit`, `node scripts/verify.mjs`.
Then: a design with a background still opens on web and native, its thumbnail still renders, and export/import still works. Nothing writes `assets/` yet, so this is a pure-capacity change — confirm that by exporting a design in a `node -e` one-liner that `unzipSync`s the bytes with `fflate` and prints the entry names (expect only `design.json` and `background.*`).

- [ ] **Step 9: Commit**

```bash
git add src/storage
git commit -m "feat(storage): named per-object asset entries with a save-time sweep"
```

---

## Phase B — The placed image

### Task B1: The `image` object kind and its three renderers

**Files:**
- Modify: `src/storage/project-schema.ts` (add `PlacedAsset`, `ImageObject`, extend `DesignObject`)
- Modify: `src/editor/EditorCanvas.tsx:56-71` (`objectBox`), `:343-387` (`ObjectLayer` content), `:83-123` (`useBackgroundImage`)
- Modify: `src/editor/render/offscreen.ts:130-157` (the object loop)
- Modify: `src/editor/export/svg.ts:350-375` (the object loop)
- Create: `src/editor/skia/image-shape.tsx` (`IMAGE_BASE_SIZE`, `<PlacedImageRenderer>`)

**Interfaces:**
- Produces:
  ```ts
  export interface PlacedAsset extends GroupMember { aspect: number; opacity: number; transform: ObjectTransform; zIndex: number }
  export interface ImageObject extends PlacedAsset { id: string; type: 'image'; imageFile: string; imageMime: string; imageUri?: string }
  export const IMAGE_BASE_SIZE = 120; // design units, beside SHAPE_BASE_SIZE
  ```
- Consumes: `useBackgroundImage(uri)` (already in `EditorCanvas.tsx`) for decoding; `drawBackgroundImage`'s cover maths is **not** reused — a placed image fills its own box.
- Consumed by: B2 (insert), and the collections/gestures layers, which need no change because they read `SizedObject.box`.

- [ ] **Step 1: Add the kind and let the compiler list the sites**

Add `PlacedAsset` and `ImageObject` and include `ImageObject` in `DesignObject`, then run `npx tsc --noEmit`. Expected: errors at `EditorCanvas.objectBox`, the `EditorCanvas` content chain, the `offscreen.ts` chain and the `svg.ts` chain — the compiler enumerating exactly the sites the render contract requires. Handle every error in the steps below; do not add a default branch to silence one.

- [ ] **Step 2: Give the object a box**

In `objectBox`, add
`case 'image': return { width: IMAGE_BASE_SIZE * obj.aspect, height: IMAGE_BASE_SIZE };`
The renderer draws into `0..box.width`/`0..box.height` and the caller translates by `-box/2`, exactly as `ShapeRenderer` and `drawShapeOnCanvas` already do.

- [ ] **Step 3: Render on the canvas**

In `ObjectLayer`'s content chain, add an `obj.type === 'image'` branch inside the same `<Group transform={[{ translateX: -box.width / 2 }, { translateY: -box.height / 2 }]}>` shape and glyph use, rendering `<PlacedImageRenderer image={obj} width={box.width} height={box.height} />`. `PlacedImageRenderer` decodes `obj.imageUri` with `Skia.Data.fromBase64` + `Skia.Image.MakeImageFromEncoded` (the same call `useBackgroundImage` makes, and for the same Android `data:` reason documented at `EditorCanvas.tsx:73-82`) and returns a `<SkiaImage fit="contain">` at the box size, or a transparent `Rect` when `imageUri` is absent or the decode fails. **Never throw** — a missing file is Review Focus 1's storage case and must degrade to nothing.

- [ ] **Step 4: Render in PNG**

In `offscreen.ts`'s object loop, make the glyph `else` explicit and add an image branch: `c.translate(-box.width / 2, -box.height / 2)`, decode the URI, and `drawImageRect` it into `0,0,box.width,box.height` (the canvas has already applied the object's transform). A failed decode draws nothing. Reuse the decode and paint helpers already in the file.

- [ ] **Step 5: Render in SVG**

In `svg.ts`'s object loop, make the glyph `else` explicit and add
`inner = '<image href="' + escapeXml(obj.imageUri ?? '') + '" x="' + (-width / 2) + '" y="' + (-height / 2) + '" width="' + width + '" height="' + height + '" preserveAspectRatio="none"/>';`
using the same `width`/`height` the box reports. `preserveAspectRatio="none"` is correct because the box already matches the aspect. If `imageUri` is absent, emit nothing.

- [ ] **Step 6: Verify the contract is satisfied at compile time**

Run: `npx tsc --noEmit` (expect clean, with no `else` fallback added) and `node scripts/verify.mjs`.

- [ ] **Step 7: Note the deferred visual proof**

A `image` object cannot be created from the UI until Task B2, so the pixel-level agreement of the three renderers is verified in Task B2's Step 6. Record that in the commit body — it is the reason this task's own verification is compile-level.

- [ ] **Step 8: Commit**

```bash
git add src/storage/project-schema.ts src/editor/EditorCanvas.tsx src/editor/render/offscreen.ts src/editor/export/svg.ts src/editor/skia/image-shape.tsx
git commit -m "feat(editor): add the image object kind and render it three ways"
```

### Task B2: Insert an image from the gallery

**Files:**
- Create: `src/storage/placed-image.ts`
- Modify: `src/storage/background-image.ts` (delegate to `pickPlacedImage`)
- Modify: `src/editor/insert-sheet.tsx` (the tab union, the tab row, a `media` tab)
- Modify: `src/editor/EditorScreen.tsx` (`insertImage`, the `InsertSheet` props, the rail button label)
- Modify: `src/i18n/strings.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PlacedImage { base64: string; mime: string; width: number; height: number }
  export function pickPlacedImage(): Promise<PlacedImage | null>;
  export type InsertTab = 'glyphs' | 'shapes' | 'media';
  // InsertSheetProps gains: onPickImage: () => void
  ```
- Consumes: `writeAssetBytes`, `assetEntryName`, `base64ToBytes`, `sniffImageMime`, `DECOR_INSERT_SCALE`, `addObject`.
- Consumed by: Task B3 (it selects an image to change its opacity), and Task C4 (the same tab, second block).

- [ ] **Step 1: Generalise the picker**

Move `pickBackgroundImage`'s body into `placed-image.ts` as `pickPlacedImage`, adding the decoded width and height (decode the base64 with `Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64))` — the editor has Skia loaded; note that in the doc comment). `pickBackgroundImage` becomes a two-line caller returning `{ base64, mime }`. The iOS permission request, `mediaTypes: ['images']`, `quality: 0.8` and `sniffImageMime` all stay byte-identical.

- [ ] **Step 2: Verify the background flow is unchanged**

Pick a background image on web and on the emulator: the behaviour and the resulting `background.<ext>` are the same as before. This is the refactor's regression test.

- [ ] **Step 3: Add the strings**

`insert` (`'إدراج'` / `'Insert'`), `media` (`'وسائط'` / `'Media'`), `insertImageFromGallery` (`'إدراج صورة'` / `'Add image'`). Keep `t.editor.glyphs`, `t.editor.shapes` and `t.editor.backgroundImage` untouched — three places read them.

- [ ] **Step 4: Write the failing observation**

Run the app, tap Insert: there is no Media tab and no way to place a photo. Record it.

- [ ] **Step 5: Add the Media tab with its Image block**

`InsertTab` becomes the three-way union; the tab row gains a `Button` for `t.editor.media`. The `media` tab renders a labelled block with one full-width `Button` labelled `t.editor.insertImageFromGallery`, wired to the new `onPickImage` prop via the existing `pick(() => …)` helper so the sheet closes before the picker opens. There is no image grid — the source is the photo library.

- [ ] **Step 6: Implement `insertImage` and verify all three renderers**

`insertImage` in `EditorScreen.tsx`: `await pickPlacedImage()`; if `null`, return; mint the id as `` `i_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` `` (matching the `t_`/`g_`/`s_` convention); convert the base64 to bytes with the repo's existing base64→bytes helper (the one `projects.web.ts` uses — if it is module-local, move it to `design-file.ts` beside `imageEntryName` rather than duplicating it); `writeAssetBytes(project.id, objectId, bytes, picked.mime)`; then `addObject({ id, type: 'image', ...stored, aspect: picked.width / picked.height, opacity: 1, transform: { x: canvas.width / 2, y: canvas.height / 2, scale: DECOR_INSERT_SCALE, rotation: 0, flipH: false, flipV: false }, zIndex: (objects.length + 1) * 10 })` and `setTool('select')`.

Then confirm on web and on the emulator: the image appears at the same place, at the same size, in the live canvas, in the exported PNG and in the exported SVG. This is the pixel-level proof Task B1 deferred, and it is the render contract's whole requirement.

- [ ] **Step 7: Relabel the rail's Insert button**

The rail button at `EditorScreen.tsx` currently reads `t.editor.glyphs` for a sheet with three tabs; change it to `t.editor.insert`. Leave the sheet's Glyphs tab label as `t.editor.glyphs`. Then run `node scripts/check-help.mjs` and `node scripts/check-shortcuts.mjs` (expect OK) — a rail label can be referenced by the catalog.

- [ ] **Step 8: Verify Review Focus 3, and the second and third rows of the matrix**

- Place a second image: both are selectable, both render, z-order follows insertion.
- Export, re-import: both come back at their positions (Review Focus 3). Then duplicate the design from the gallery and check both images too — that path copies bytes separately.
- Delete one image, force a save (leave the editor), reopen: the other survives and the deleted object's `img_<id>.*` is gone from the directory (or the `:img:` key is gone on web).
- Delete an image and immediately undo, then leave the editor and reopen. **Review Focus 2**: the object and its pixels are both still there.

- [ ] **Step 9: Full check, format, commit**

Run: `node scripts/verify.mjs`, `yarn format:fix`.

```bash
git add src/storage/placed-image.ts src/storage/background-image.ts src/editor/insert-sheet.tsx src/editor/EditorScreen.tsx src/i18n/strings.ts
git commit -m "feat(editor): place a gallery image from the Insert sheet"
```

### Task B3: A generic opacity action for the placed kinds

**Files:**
- Modify: `src/editor/selection-actions.tsx` (the `SelectionShape` interface and the availability table)
- Modify: `src/editor/EditorScreen.tsx` (compute `isImage`/`isIcon`; handle the new action)
- Modify: `src/editor/help/catalog.ts` (`sel.opacityOpen`)
- Modify: `src/i18n/strings.ts` (`opacityOpen`, `opacity`)

**Interfaces:**
- Produces: `SelectionActionId` gains `'opacityOpen'`; `SelectionShape` gains `readonly isImage: boolean; readonly isIcon: boolean;`
- Consumes: the existing `styleOpen` / `glyphStyle` action machinery and `components/ui/slider.tsx`.
- Consumed by: Task C4 (an icon is also opacity-adjustable).

- [ ] **Step 1: Read the pattern, do not invent one**

Read `docs/editor-selection-bar.md` §2 and §6, then the `styleOpen` and `glyphStyle` handlers in `EditorScreen.tsx`: they are the two existing sheet-opening actions. The new action must open its sheet the same way, with the same slot/overflow treatment.

- [ ] **Step 2: Write the failing observation**

Select a placed image: there is no way to fade it. Record it.

- [ ] **Step 3: Add the action**

Add `'opacityOpen'` to `SelectionActionId`, `isImage`/`isIcon` to `SelectionShape`, and `case 'opacityOpen': return shape.isImage || shape.isIcon;` to the availability function. Add `opacityOpen` to `SelectionActionId`'s help-catalog group and to the overflow list only if the existing table's `SHEET_ORDER` pattern requires it — follow `styleOpen` exactly.

- [ ] **Step 4: Add the sheet and the mutator**

Render the slider in the same sheet host `styleOpen` uses; its value is the selected object's `opacity` and its change calls `updateObject(id, { opacity })` for every selected object that is an image or icon. `opacity` is already a field on every kind and is already applied by all three renderers, so no renderer changes.

- [ ] **Step 5: Verify**

- Select an image, fade it: the canvas, the exported PNG and the exported SVG all show the same faded result.
- Undo: the opacity change is one undoable step (it goes through `updateObject`, which snapshots).
- Run: `node scripts/check-help.mjs` and `node scripts/check-shortcuts.mjs` — both must pass, which proves the catalog entry and its strings are complete.

- [ ] **Step 6: Full check, format, commit**

Run: `node scripts/verify.mjs`, `yarn format:fix`.

```bash
git add src/editor/selection-actions.tsx src/editor/EditorScreen.tsx src/editor/help/catalog.ts src/i18n/strings.ts
git commit -m "feat(editor): fade a placed image or icon from the selection bar"
```

---

## Phase C — Imported icons

### Task C1: The Iconify identity, the allowlist, its licence record and its check

**Files:**
- Create: `src/theme/icon-sets.ts`
- Create: `scripts/check-icons.mjs`
- Create: `THIRD-PARTY-ICONS.md`
- Modify: `scripts/verify.mjs:40-80` (register the task)
- Modify: `src/theme/index.ts` (re-export the module if the theme barrel re-exports its peers)

**Interfaces:**
- Produces:
  ```ts
  export const ICONIFY_HOSTS: readonly string[];
  export const ICON_SEARCH_LIMIT = 32;
  export const ICON_SET_ALLOWLIST: Readonly<Record<string, { name: string; license: { title: string; spdx: string; url: string } }>>;
  export function iconSearchUrl(query: string, limit: number): string;
  export function iconDataUrl(prefix: string, name: string): string;
  export function parseIconKey(key: string): { prefix: string; name: string } | null;
  export function iconKey(prefix: string, name: string): string;
  ```
- Consumes: nothing (no imports at all — the check transpiles it standalone).
- Consumed by: C2, C3, C4.

- [ ] **Step 1: Write the failing check**

Create `scripts/check-icons.mjs` following `check-fonts.mjs`'s shape (transpile the target module, evaluate it, assert, print `... OK` or exit 1), and register it in `scripts/verify.mjs`'s `TASKS` as `{ id: 'icons', command: [join(here, 'check-icons.mjs')] }`.
First assertions, which must fail against a missing module: the three hosts in order with `api.iconify.design` first, `iconSearchUrl('home', 32) === 'https://api.iconify.design/search?query=home&limit=32'`, `iconDataUrl('material-symbols', 'home') === 'https://api.iconify.design/material-symbols.json?icons=home'`, `parseIconKey(iconKey('a', 'b'))` round-trips, `parseIconKey('no-colon')` is `null`, the allowlist is non-empty, and every allowlisted prefix appears in `THIRD-PARTY-ICONS.md`.

- [ ] **Step 2: Run it to see it fail**

Run: `node scripts/check-icons.mjs`
Expected: a failure naming the missing `src/theme/icon-sets.ts`.

- [ ] **Step 3: Write the module**

Implement the URL builders against the documented API (`/search?query=&limit=`, `/{prefix}.json?icons=`) and the allowlist with the sets' real licence titles, SPDX identifiers and URLs (from Iconify's `/collections` metadata). Monotone sets only — do not allowlist a palette set. `search`'s `limit` minimum is 32, so `ICON_SEARCH_LIMIT` is 32.

- [ ] **Step 4: Write the licence record**

`THIRD-PARTY-ICONS.md` at the repo root: one row per allowlisted set with name, licence title, SPDX id and URL, plus a sentence naming Iconify as the aggregating source. Keep it the same content as the allowlist — the check pins them together.

- [ ] **Step 5: Run both**

Run: `node scripts/check-icons.mjs` (expect OK) and `node scripts/verify.mjs` (expect 17 tasks, exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/theme/icon-sets.ts src/theme/index.ts scripts/check-icons.mjs scripts/verify.mjs THIRD-PARTY-ICONS.md
git commit -m "feat(icons): add the Iconify identity, allowlist and licence record"
```

### Task C2: Resolve an Iconify icon body to paths

**Files:**
- Create: `src/editor/icons/icon-geometry.ts`
- Modify: `scripts/check-icons.mjs` (the geometry assertions)

**Interfaces:**
- Produces:
  ```ts
  export interface IconPath { d: string; fillRule: 'nonzero' | 'evenodd' }
  /** Resolve an Iconify icon body to drawable paths. Returns null when the body
   *  contains any element other than <path> or a <g> wrapper. */
  export function iconPathsFromBody(body: string): IconPath[] | null;
  ```
- Consumes: nothing.
- Consumed by: C3 (the renderers), C4 (the picker, to refuse an unsupported icon before insert).

- [ ] **Step 1: Write the failing assertions**

Add fixtures to `scripts/check-icons.mjs`:
- a single `<path d="M0 0h24v24H0z"/>` → one path, `fillRule: 'nonzero'`;
- two sibling paths → two paths, in document order;
- a `<g fill-rule="evenodd"><path d="…"/></g>` → one path with `fillRule: 'evenodd'` (inherited from the `<g>`);
- a `clip-rule="evenodd"` on the path itself → `evenodd`;
- a body containing `<circle cx="…"/>` → `null`;
- a body containing `<g transform="matrix(…)">` → `null` (**transform is not honoured; refusing beats drawing it wrongly**);
- an empty body → `null`.
Expected on the first run: failure, the module does not exist.

- [ ] **Step 2: Implement the resolver**

A small, dependency-free walker over the body: match `<path …>` elements, read `d`, and read `fill-rule`/`clip-rule` from the path or its nearest `<g>` ancestor; return `null` on the first element that is neither `<path>` nor `<g>`, or on any `transform` attribute. Everything else in the body is ignored. It must not use a DOM parser — React Native has none.

- [ ] **Step 3: Run the check**

Run: `node scripts/check-icons.mjs`
Expected: `check-icons: OK`, with all seven fixtures asserted.

- [ ] **Step 4: Commit**

```bash
git add src/editor/icons/icon-geometry.ts scripts/check-icons.mjs
git commit -m "feat(icons): resolve an Iconify icon body to path geometry"
```

### Task C3: The `icon` object kind and its three renderers

**Files:**
- Modify: `src/storage/project-schema.ts` (`IconObject`, extend `DesignObject`)
- Modify: `src/editor/EditorCanvas.tsx` (`objectBox`, `ObjectLayer`)
- Modify: `src/editor/render/offscreen.ts` (the object loop)
- Modify: `src/editor/export/svg.ts` (the object loop)
- Create: `src/editor/skia/icon-shape.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface IconObject extends PlacedAsset {
    id: string; type: 'icon';
    iconKey: string;                                  // prefix:name — provenance only
    viewBox: { width: number; height: number };
    color: string;
    paths: { d: string; fillRule: 'nonzero' | 'evenodd' }[];
  }
  ```
- Consumes: `IconPath` (C2), `IMAGE_BASE_SIZE` (B1), `Skia.Path.MakeFromSVGString`.
- Consumed by: C4.

- [ ] **Step 1: Add the kind and let the compiler list the sites**

Add `IconObject` to `DesignObject` and run `npx tsc --noEmit`. Expected: the same four sites as Task B1's Step 1, now for a second kind.

- [ ] **Step 2: Give it a square box**

`objectBox`: `case 'icon': return { width: IMAGE_BASE_SIZE, height: IMAGE_BASE_SIZE };` — square, because the drawing scales from the viewBox to the box.

- [ ] **Step 3: Render on the canvas**

One `<Path>` per entry inside the translate group, with a `Group` scaling `viewBox → box` and a `Paint` filled with `obj.color`. `react-native-skia`'s `<Path path={d}>` accepts the SVG `d` string directly, so no parse step is needed here.

- [ ] **Step 4: Render in PNG**

Per entry: `Skia.Path.MakeFromSVGString(d)`; if it returns `null`, skip that path (never throw); `canvas.save()`, scale from `viewBox` to `IMAGE_BASE_SIZE`, translate by `-IMAGE_BASE_SIZE / 2`, `drawPath(path, paint)` with the object's colour and the entry's fill rule, `canvas.restore()`.

- [ ] **Step 5: Render in SVG**

Per entry, emit `<path d="…" fill="…" fill-rule="…"/>`, wrapped in a `<g transform="scale(sx sy)">` from the viewBox to the box. This is true vector output, which is the reason the object stores paths rather than a raster.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` (clean, no `else` fallback) and `node scripts/verify.mjs`. The visual proof arrives in Task C4.

- [ ] **Step 7: Commit**

```bash
git add src/storage/project-schema.ts src/editor/EditorCanvas.tsx src/editor/render/offscreen.ts src/editor/export/svg.ts src/editor/skia/icon-shape.tsx
git commit -m "feat(editor): add the icon object kind and render it three ways"
```

### Task C4: Search, download and insert an icon

**Files:**
- Modify: `src/storage/icon-search.ts` (create — the fetch + cache-free search)
- Modify: `src/editor/insert-sheet.tsx` (the Media tab's Icons block)
- Modify: `src/editor/EditorScreen.tsx` (`insertIcon`, availability of the colour action)
- Modify: `src/editor/selection-actions.tsx` (the colour action applies to `isIcon`)
- Modify: `src/i18n/strings.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/storage/icon-search.ts
  export interface IconSearchHit { key: string; prefix: string; name: string; setName: string; palette: boolean }
  export async function searchIcons(query: string): Promise<IconSearchHit[]>;
  /** Fetch one icon and resolve it. Returns null for an unsupported or palette icon. */
  export async function fetchIcon(hit: IconSearchHit): Promise<{ paths: IconPath[]; viewBox: { width: number; height: number } } | null>;
  ```
- Consumes: `ICONIFY_HOSTS`, `iconSearchUrl`, `iconDataUrl`, `parseIconKey` (C1); `iconPathsFromBody` (C2); `addObject`.
- Produced for: Task D1 (docs).

- [ ] **Step 1: Write the fetch layer**

`searchIcons` tries each host in `ICONIFY_HOSTS` in order, and treats a non-`ok` response or a thrown `fetch` as a reason to try the next host; if all three fail it **throws**, so the UI has one failure path. Read `collections` from the response to fill `setName` and `palette`. `fetchIcon` fetches `iconDataUrl(prefix, name)`, reads `width`/`height` (default 24) and the body for the one icon, and returns `iconPathsFromBody(body)`'s result — `null` for a palette icon or an unsupported body, without a second network call.

- [ ] **Step 2: Verify the URL and refusal rules by hand**

In a scratch `node -e` (or the browser console on web): call `searchIcons('home')` and confirm hits come back; call `fetchIcon` on a Lucide path icon (expect paths) and on an emoji set hit (expect `null`). Delete the scratch code.

- [ ] **Step 3: Add the Icons block to the Media tab**

Below the Image block: a `TextInput` for the query, a loading indicator, an error `Text` for `t.editor.iconSearchFailed`, a "no results" line, and a mapped result list capped at 32. Each row draws the icon from its geometry (the same `<Path>` loop as the canvas renderer, in a fixed preview size) plus the set name, and is **disabled** with the reason `t.editor.iconSetPaletteUnsupported` or `t.editor.iconShapeUnsupported` when `fetchIcon` would refuse it. Per-row state is `idle → downloading → error` using `ActivityIndicator`, the same shape the Google Fonts weight chips use.

- [ ] **Step 4: Implement `insertIcon` and verify three renderers**

`insertIcon(hit)`: set the row's downloading state, `await fetchIcon(hit)`, and on success `addObject({ id: `ic_<ts>_<rand>`, type: 'icon', iconKey: hit.key, viewBox, paths, color: DEFAULT_INK, aspect: viewBox.width / viewBox.height, opacity: 1, transform: { …centred, scale: DECOR_INSERT_SCALE… }, zIndex: (objects.length + 1) * 10 })` then `setTool('select')`. On failure, set that row's error state. Then confirm on web and on the emulator: the same icon, same size, in the canvas, the PNG and the SVG, and the SVG scales without blur (**the vector proof**).

- [ ] **Step 5: Extend the colour action to icons**

Read the availability rule that gates the existing colour action for shapes and glyphs, and add `|| shape.isIcon`. A raster image stays excluded (its colour is its pixels); an icon is drawn from paths, so colour is meaningful.

- [ ] **Step 6: Verify Review Focus 4 and 5**

- Turn off networking (airplane mode / the emulator's network) and search: a visible failure message appears, the spinner stops, and the Image block still inserts. **Review Focus 4**.
- Import a palette hit (an emoji): the row is disabled with a reason and cannot be inserted. **Review Focus 5**.
- Insert an icon, change its colour, leave the editor and reopen with networking off: the icon draws in its colour with no network. (The paths travel in the document.)
- Undo the icon insert: the object disappears and the document is clean.

- [ ] **Step 7: Full check, format, commit**

Run: `node scripts/verify.mjs` (17 tasks), `yarn format:fix`.

```bash
git add src/storage/icon-search.ts src/editor/insert-sheet.tsx src/editor/EditorScreen.tsx src/editor/selection-actions.tsx src/i18n/strings.ts
git commit -m "feat(editor): search and place an Iconify icon"
```

---

## Phase D — Docs and the 0.6.0 release

### Task D1: Documentation and the changelog

**Files:**
- Modify: `docs/storage-format.md` (the version section, the migration paragraph, the entry table)
- Modify: `docs/editor-render-contract.md` (the object-kind table and the agreement section)
- Modify: `docs/index.md` (§2's "Add a shape or a glyph" row; §7's uncovered list)
- Modify: `AGENTS.md` (the read-contract table)
- Modify: `CHANGELOG.md:8` (`[Unreleased]`)

**Interfaces:**
- Consumes: every task above.
- Produces: the docs that the next person editing this area is sent to.

- [ ] **Step 1: Rewrite the storage contract**

`docs/storage-format.md`: the entry table gains `assets/<objectId>.<ext>`; the version section says 3; the "no migration" paragraph is replaced by the reader's exact rule (accepts 2 and 3, normalizes to 3, a v2 document has no image or icon objects, and the reader is `normalizeProjectVersion`). Note the save-time sweep and why it makes undo safe.

- [ ] **Step 2: Extend the render contract**

`docs/editor-render-contract.md`: the object-kind table gains `image` and `icon`; the agreement section states that an image is drawn into `0..box` after the caller's `-box/2` translate, and that an icon scales from its viewBox to the box, in all three renderers.

- [ ] **Step 3: Update the index and the agent contract**

`docs/index.md` §2: "Add a shape or a glyph" → "Add a shape, a glyph or a placed asset". §7: remove `src/editor/icons/` from the uncovered list if it was implied by `src/editor/**` (it is not named today, so this is a no-op unless a row is added). `AGENTS.md`: add a row — editing `src/storage/project-schema.ts`, `src/storage/design-file.ts` or `src/editor/icons/**` → read `docs/storage-format.md` and `docs/superpowers/specs/2026-10-04-placed-assets-0-6-design.md`.

- [ ] **Step 4: Write the [Unreleased] body**

`### Added`: a placed image element, an imported icon element, a `.midad` v3 container with named per-object assets, an Import sheet tab with a Media section, and a fade action. `### Changed`: the document version and the first reader for an older version. `### Fixed`: nothing. Name the two honest limits in the repo's voice: v1 images are transformed and faded but not cropped, and an icon's shapes are resolved to paths at insert time so a body with an unhandled element is refused rather than approximated.

- [ ] **Step 5: Run the full matrix from the spec §11**, every row, on web and on the emulator.

- [ ] **Step 6: Full check, format, commit**

Run: `node scripts/verify.mjs` (17 tasks, exit 0), `yarn format:fix`.

```bash
git add docs AGENTS.md CHANGELOG.md
git commit -m "docs: record the placed-asset model, the container and the icon source"
```

### Task D2: Release 0.6.0

**Files:**
- Modify: `package.json:4`, `app.json:5`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `docs/superpowers/plans/2026-10-04-ui-polish-0-5.md` Tasks 0.1, 0.2 and 0.3 — this is the same three-step release procedure with the versions substituted, so follow those steps rather than re-deriving them.
- Produces: `main` == `staging` at `v0.6.0`; `develop` bumped to `0.7.0`.

- [ ] **Step 1: Test a release build on a device before tagging**

Run: `yarn android:build:apk` (or the local emulator flow) and install it. Exercise the five Review Focus conditions plus the spec §11 matrix on the release build — the debug build's caching hides the load and the icon fetch. In particular, open a design created **before** this change and an export produced by the previous release. Do not tag until this passes.

- [ ] **Step 2: Prepare `v0.6.0-rc.1`** — Task 0.1 of the 0.5.0 plan, `0.4.0-rc.1` → `0.6.0-rc.1`.

- [ ] **Step 3: Finalise `v0.6.0`** — Task 0.2 of the 0.5.0 plan, `0.4.0` → `0.6.0`.

- [ ] **Step 4: Open 0.7.0** — Task 0.3 of the 0.5.0 plan, `0.5.0` → `0.7.0`.

- [ ] **Step 5: Record the outcome**

Report the tags pushed, the branch state, and which device and OS theme the matrix was run on. The version-2 reader's result on a device that had designs before the upgrade is the one line of evidence a reviewer will ask for; state it explicitly.
