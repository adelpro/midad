# Placed assets for 0.6.0 — design

**Status:** proposed 2026-10-04
**Files:** `src/storage/project-schema.ts`, `src/storage/design-file.ts`, `src/storage/projects.ts`, `src/storage/projects.native.ts`, `src/storage/projects.web.ts`, `src/storage/project-io.ts`, `src/storage/import-project.ts`, `src/storage/background-image.ts`, `src/editor/EditorCanvas.tsx`, `src/editor/render/offscreen.ts`, `src/editor/export/svg.ts`, `src/editor/insert-sheet.tsx`, `src/editor/EditorScreen.tsx`, `src/editor/selection-actions.tsx`, `src/editor/collection-bar.tsx`, `src/editor/icons/**`, `src/editor/skia/**`, `src/theme/icon-sets.ts`, `src/i18n/strings.ts`, `scripts/check-icons.mjs`, `scripts/verify.mjs`, `docs/storage-format.md`, `docs/editor-render-contract.md`, `docs/index.md`, `AGENTS.md`, `THIRD-PARTY-ICONS.md`

> This design adds two object kinds to the editor — a placed raster image and an
> imported vector icon — and the document change they force. It owns the object
> model, the `.midad` v3 container and its first reader for an older version, the
> icon source and its licence record, and renderer parity. It argues from what
> the render contract and the storage contract already require; when this
> document and the code disagree, fix the code.

---

## 1. What is wrong, measured

1. **There is no image element.** `DesignObject = CalligraphyTextObject |
   GlyphObject | ShapeObject`. The rail's `image` button is the *background*
   tool; `pickBackgroundImage` is the only `expo-image-picker` call site. The
   feature does not exist to be shown, so "I can't see it in the tools box" is
   not a discoverability bug.
2. **There is no way to import an icon.** There is no generic remote-asset
   subsystem; the `remote-fonts` family is the only precedent, and it is
   font-specific. There is no icon attribution file anywhere in the repo.
3. **The container holds exactly one image.** `CanvasBackground` has a single
   `imageFile`/`imageMime`/`imageUri`; the native store deletes every
   `background.*` file on each write (`clearImages`) and the web store has one
   `:bg` key per design; `packDesign(project, image)` and
   `UnpackedDesign.image` are singular; `imageEntryName` hard-codes the
   `background.` prefix; and `toPersisted` strips only
   `canvas.background.imageUri`. `PROJECT_FILE_VERSION` is 2 and — by policy —
   has no reader for an older version.
4. **A version bump would hide every existing design.** `loadProject` and
   `unpackDesign` reject any `version !== PROJECT_FILE_VERSION` by returning
   `null`, and the gallery treats `null` as absent. Bumping to 3 without a
   reader makes every design already on the device disappear from the gallery.

## 2. Decisions

| #   | Decision                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Two new object kinds: `image` (placed raster) and `icon` (imported vector).                                                          |
| D2  | Both carry a shared `aspect` and the asset-reference fields; the image is bytes, the icon is resolved path geometry.                  |
| D3  | Geometry is additive: the object's box is `base × aspect`, the renderer draws into `0..size`, exactly as shapes already do.           |
| D4  | `.midad` becomes version 3 with named entries under `assets/`; the background keeps `background.<ext>` unchanged.                     |
| D5  | **A first reader for version 2** normalizes a v2 document to v3 in memory. The "no migration" policy is retired for this one step.   |
| D6  | Per-asset storage on both platforms, keyed by object id; orphans are swept on save.                                                    |
| D7  | Icons are stored as resolved `{ d, fillRule }` paths, not as SVG markup and not as rasters — vector on all three renderers, offline.   |
| D8  | Icons come from the Iconify public API (monotone sets only), with a licence allowlist and a static `THIRD-PARTY-ICONS.md`.             |
| D9  | The insert surface is a third `media` tab on `InsertSheet`; the rail's existing Insert button is relabelled so the tool is nameable.   |
| D10 | Opacity becomes a generic selection action for the new kinds; the colour action applies to icons but not to images.                    |

## 3. The object model (D1, D2, D3)

`src/storage/project-schema.ts` gains:

```ts
/** Fields shared by an object that renders a stored or resolved asset. */
export interface PlacedAsset extends GroupMember {
  /** Intrinsic width ÷ height, so the object's box matches the asset. */
  aspect: number;
  opacity: number;
  transform: ObjectTransform;
  zIndex: number;
}

export interface ImageObject extends PlacedAsset {
  id: string;
  type: 'image';
  /** Name of the stored image inside the design's package. Persisted. */
  imageFile: string;
  imageMime: string;
  /** Data URI rebuilt from the stored bytes on load. In-memory only. */
  imageUri?: string;
}

export interface IconObject extends PlacedAsset {
  id: string;
  type: 'icon';
  /** The Iconify identity, `prefix:name`. Provenance and attribution only. */
  iconKey: string;
  /** The icon's viewBox, from the API response. */
  viewBox: { width: number; height: number };
  color: string;
  /** Resolved vector geometry, in viewBox units. Self-contained; no network on load. */
  paths: { d: string; fillRule: 'nonzero' | 'evenodd' }[];
}
```

`DesignObject` becomes a four-way union. `aspect` is stored rather than
measured because the renderers have no decode step in the SVG path and should
not need one: for an image it is read once from the picked bytes at insert time
(`Skia.Image.MakeImageFromEncoded`), for an icon it is `viewBox.width /
viewBox.height`.

Geometry follows the shape convention exactly. A new constant
`IMAGE_BASE_SIZE = 120` (design units) lives beside `SHAPE_BASE_SIZE`, and
`objectBox` in `EditorCanvas.tsx` returns
`{ width: IMAGE_BASE_SIZE * obj.aspect, height: IMAGE_BASE_SIZE }` for an image
and `{ width: IMAGE_BASE_SIZE, height: IMAGE_BASE_SIZE }` for an icon. Insertion
uses `DECOR_INSERT_SCALE` (2) and the same centred transform and
`zIndex: (objects.length + 1) * 10` the glyph and shape inserts use, so a fresh
image lands 240 units tall. Everything downstream — `hit-test.ts`,
`groups.ts`, `collection-bar.tsx`, the gestures, the alignment actions — is
already generic over `SizedObject`'s `box`/`ink` and needs no kind branch; the
only geometry change is the `objectBox` case.

The one place that discriminates on kind inside the gestures,
`use-object-gestures.ts` (the E/W handle that sets `wrapWidth` for text), is
untouched: E/W on an image or icon falls through to uniform scale, which is what
shapes and glyphs already do. Non-uniform resize is out of scope.

## 4. The container and the version-2 reader (D4, D5)

`PROJECT_FILE_VERSION` becomes `3`. The entry naming changes only for object
assets:

| Entry                     | Owner                          | Level        |
| ------------------------- | ------------------------------ | ------------ |
| `design.json`             | the document                   | DEFLATE      |
| `background.<ext>`        | `canvas.background`            | stored (0)   |
| `assets/<objectId>.<ext>` | one `ImageObject`              | stored (0)   |

`imageEntryName(mime)` keeps its `background.` contract and gains a sibling
`assetEntryName(objectId, mime)` returning `assets/<objectId>.<ext>`;
`EXT_BY_MIME` is shared. `packDesign(project, assets)` takes
`{ bytes, mime, name }[]` instead of one image, and `UnpackedDesign` gains
`assets: { name: string; bytes: Uint8Array; mime: string }[]` alongside the
existing singular `image` for the background. Storing image entries at level 0 is
unchanged and its reason is unchanged (`docs/storage-format.md`: JPEG and PNG are
already compressed).

**The version-2 reader.** `unpackDesign` and both `loadProject`s accept
`version === 2 || version === 3`. A v2 document is normalized in memory:

- `version` is set to `3`;
- `canvas.background` is kept exactly as it is (`background.<ext>` is unchanged,
  and every v2 design has at most that one image);
- `objects` cannot contain an image or an icon, so they pass through untouched.

The reader exists at **three** call sites, and all three must agree:
`design-file.ts` (import), `projects.native.ts` (device load), `projects.web.ts`
(device load). A shared `normalizeProjectVersion(project)` in
`project-schema.ts` (or `design-file.ts`) is the single implementation, so the
rule is stated once. `docs/storage-format.md` is rewritten in two places: the
version section (`2` → `3`, and the reader's existence with its exact rule) and
the "no migration" paragraph.

Version 3 files written by a *future* build that a v2-era build reads are not a
concern: the version check is an equality-or-known-set test, and there is no
released build between them.

## 5. Per-asset storage (D6)

`src/storage/projects.ts` gains, next to the existing background functions:

```ts
export declare function writeAssetBytes(
  id: string,
  objectId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<StoredImage>;

export declare function readAssetBytes(
  id: string,
  imageFile: string,
): Promise<Uint8Array | null>;
```

Native (`projects.native.ts`): the file name is `img_<objectId>.<ext>` from the
same `EXT_BY_MIME`, written under the design's directory;
`writeAssetBytes` deletes any `img_<objectId>.*` first (the MIME, and therefore
the extension, can change), which is the per-object version of today's
`clearImages`. `attachImageUri` gains a second loop that rebuilds
`imageUri` for every `ImageObject` whose file exists, and
`toPersisted` gains the matching strip — for images, the object's `imageUri` is
dropped exactly as the background's is, because a leaked data URI would inline
multi-megabyte strings into `design.json`.

Web (`projects.web.ts`): one AsyncStorage key per object,
`midad-projects:<id>:img:<objectId>`; `readAssetBytes` reads that key rather
than the background key. `deleteProject` must remove every key it owns, so the
`:img:` keys are removed by prefix (`AsyncStorage.getAllKeys()` filtered, or a
per-design key list — the read is small and this is a delete path).

**Orphan sweep.** Deleting an object, or replacing an image on an existing
object, leaves bytes behind. Both platforms sweep on `saveProject`: native lists
the design directory and deletes any `img_*` file whose object id is not in
`project.objects`; web does the same over `getAllKeys()` for that design's
`:img:` keys. Sweeping on save rather than hooking every mutation keeps the rule
in one place and makes undo/redo safe for free — an undone delete is an object
that is present again, so its bytes are never swept.

## 6. The icon object (D7, D8)

### Identity and source

`src/theme/icon-sets.ts` is a pure module (no imports, so a check script can
transpile it standalone) holding:

```ts
export const ICONIFY_HOSTS = [
  'https://api.iconify.design',
  'https://api.simplesvg.com',
  'https://api.unisvg.com',
] as const;

/** The sets the picker is allowed to offer, each with its licence. */
export const ICON_SET_ALLOWLIST: Record<
  string,
  { name: string; license: { title: string; spdx: string; url: string } }
>;

export function iconSearchUrl(query: string, limit: number): string; // /search?query=&limit=
export function iconDataUrl(prefix: string, name: string): string;   // /{prefix}.json?icons=
export function parseIconKey(key: string): { prefix: string; name: string } | null;
```

Three hosts because Iconify's public API is multi-host and documents the backups
for exactly this reason; the fetch tries them in order and treats a non-`ok`
response as a failure worth retrying on the next host. `search` returns
`{ icons: string[], total, collections }` and its `limit` has a minimum of 32,
so the picker asks for exactly 32 and pages with `start` when the result fills
the page. `collections` in the search response carries `{ name, author,
license: { title, spdx, url } }` per prefix; the picker uses it only to show
which set a hit came from, and the allowlist is the authority for what may be
inserted.

**Monotone only.** `collections[prefix].palette === true` means the set has
baked palettes (emoji, logos). Those cannot be recoloured and would not render
as a single ink path set, so a hit in a palette set is shown as disabled with the
reason, not silently inserted. This is the whole point of importing icons into a
calligraphy editor: a pictogram you can ink.

### From SVG to stored paths

The icon's data endpoint returns the icon body as inner markup plus a viewBox.
Rather than render that markup with `Skia.SVG` — whose module is unavailable in
the CanvasKit web build, which would split the PNG export path per platform — the
icon is resolved to **paths** and everything downstream uses only the core Skia
Path API, which exists on native and on CanvasKit alike:

`src/editor/icons/icon-geometry.ts` (pure, no imports):

```ts
/** One drawable path of an icon, in viewBox units. */
export interface IconPath {
  d: string;
  fillRule: 'nonzero' | 'evenodd';
}

/** Resolve an Iconify icon body to paths. Returns null for an unsupported icon. */
export function iconPathsFromBody(body: string): IconPath[] | null;
```

It walks the body's elements: `<path d="…" fill-rule="…"/>` becomes one entry
(`clip-rule` is accepted as a synonym, `evenodd` wins if either says so), a
`<g>` is descended into and its `fill-rule` is inherited, and **any other
element makes the whole icon unsupported** — no silent shape loss. That is the
deliberate trade: a `<circle>` icon is refused with a visible reason rather than
drawn wrongly, and the allowlist is chosen so the refusal is rare. `@iconify/utils`
was considered for this and rejected: its parsed form is still markup
(`parseSVGContent` → `convertParsedSVG` yields a `body` string), so it would add
a dependency without removing the markup problem.

An unsupported icon is a disabled row in the picker, the same way a palette set
is.

### Storage and rendering

The object stores the resolved `paths` and the `viewBox`, so the document is
self-contained: opening a design with imported icons needs no network, and the
same design opens on a device that has never reached Iconify. Only the *search
and download at insert time* touch the network, which is what "import from
public sources" means. `iconKey` is kept for provenance and attribution; it is
never dereferenced at render time.

Renderer parity is three sites, all of which already have a glyph branch to
mirror:

- **Canvas** (`EditorCanvas.tsx`): a `<Group translate(-box/2)>` containing one
  `<Path>` per entry, scaled from the viewBox to `size`. Colour is the object's.
- **PNG** (`render/offscreen.ts`): `Skia.Path.MakeFromSVGString(d)` per entry,
  a `Skia.Paint` in the object's colour, `canvas.scale` from the viewBox to
  `SHAPE_BASE_SIZE`, then `drawPath`. A path that fails to parse is skipped, not
  thrown.
- **SVG** (`export/svg.ts`): `<path d="…" fill="…" fill-rule="…"/>` per entry
  inside the object's existing `<g transform>`. True vector in the export, which
  is the reason D7 stores paths rather than a raster.

### Attribution (D8)

`THIRD-PARTY-ICONS.md` at the repo root records every allowlisted set: its name,
its licence title, its SPDX identifier and its licence URL. `icon-sets.ts`'s
allowlist is the machine-readable copy and a new `scripts/check-icons.mjs` pins
the two together, so a set cannot be added to the picker without its licence
being recorded. The file is generated text, not a build artifact.

## 7. The insert surface (D9)

`InsertSheet` gains a third tab. `InsertTab` becomes
`'glyphs' | 'shapes' | 'media'` and the tab row gains a `Button` for
`t.editor.media`. The `media` tab renders two labelled blocks:

1. **Image** — one full-width button labelled `t.editor.imageFromGallery` that
   runs the picker and inserts. There is no image grid, because there is nothing
   to browse: the source is the photo library.
2. **Icons** — a search field, a `FlatList`-free mapped result list capped at 32,
   one row per hit showing the icon drawn from its `paths` plus its set's name,
   with a downloading state per row (the same `downloading → installed | retry`
   shape the Google Fonts rows use, and the same `ActivityIndicator`).

The rail's Insert button currently reads `t.editor.glyphs`, which names only one
of its three tabs. It is relabelled `t.editor.insert`. A **seventh rail button**
was rejected: the rail is capped at `layout.maxToolbar` (560) and already
carries six, and the width budget in `docs/editor-selection-bar.md` is the
constraint that makes the toolbar truncate. Changing the label is what makes the
tool discoverable without spending width.

`pickBackgroundImage` is generalized into
`src/storage/placed-image.ts` → `pickPlacedImage(): Promise<PlacedImage | null>`
returning `{ base64, mime, width, height }`, with `pickBackgroundImage` becoming
a thin caller that drops the dimensions. The MIME sniffing and the iOS
permission request are unchanged, so the existing background flow keeps its exact
behaviour.

## 8. Selection actions (D10)

`SelectionShape` (`selection-actions.tsx`) gains `isImage` and `isIcon`, computed
in `EditorScreen.tsx` the way `isText` and `isGlyph` already are. Availability
follows the existing table:

- `imageDelete` / `iconDelete` need no new action — `delete` already exists.
- `opacityOpen` (new id) is available when `shape.isImage || shape.isIcon`, and
  opens an opacity slider in the selection sheet, reusing
  `components/ui/slider.tsx`. `updateObject(id, { opacity })` is the mutator;
  `opacity` is already a field on every object kind and is already applied by the
  renderers.
- The existing colour action applies to `isIcon`; there is no per-object colour
  for a raster image, so it stays hidden for `isImage`. This is a real product
  choice, not an omission: an image's colour is its pixels.

A new `sel.opacityOpen` id means a new help catalog entry and new strings, which
`check-help.mjs` enforces as a set (`docs/index.md` §5: a new selection-bar action
is a table entry plus a `sel.<id>` catalog entry plus strings, then both checks).

## 9. Out of scope

- **Crop, frames, masks, blend modes, and non-uniform resize** for a placed
  image. v1 is a placed, transformed, faded picture.
- **Re-colouring or re-downloading an icon after insert.** An icon's colour can
  be changed (D10) because it is drawn from paths; changing the *icon* means
  inserting another.
- **Multi-image import in one gesture**, and any image browser inside the app.
- **Google Fonts-style caching of icon bodies.** The paths travel in the
  document, so there is no cache to invalidate.
- Any change to how the *background* image is picked, stored or rendered beyond
  the shared `pickPlacedImage` refactor.

## 10. Checks and docs

- New `scripts/check-icons.mjs`, registered in `scripts/verify.mjs`'s `TASKS`
  (which takes the task count from sixteen to seventeen): it transpiles
  `icon-sets.ts` and `icon-geometry.ts` standalone and asserts the URL builders,
  `parseIconKey` round-trip, the host list, the allowlist, and the two required
  properties — a `<path>` body resolves to paths, a non-path body resolves to
  `null`, and a `fill-rule="evenodd"` on a `<g>` is inherited. It also reads
  `THIRD-PARTY-ICONS.md` and asserts every allowlisted prefix appears in it.
- `docs/storage-format.md` — the version section and the migration paragraph
  (D4, D5), and the entry table.
- `docs/editor-render-contract.md` — the object-kind table and the "all three
  renderers agree" section gain the two kinds.
- `docs/index.md` — the new `editor-placed-assets`-style contract row is **not**
  needed (this spec is a design record, not a contract document); the index's
  "Add a shape or a glyph" row gains "or a placed asset", and §7's list of
  uncovered areas drops `src/editor/icons/`.
- `AGENTS.md` — the read-contract table gains a row: editing
  `project-schema.ts`, `design-file.ts`, or anything under `src/editor/icons/`
  → read `docs/storage-format.md` and this spec.
- New strings in `src/i18n/strings.ts`: `media`, `insert`, `imageFromGallery`,
  `searchIcons`, `icons`, `iconSetPaletteUnsupported`, `iconShapeUnsupported`,
  `iconSearchFailed`, `opacityOpen`, `opacity`.
- `THIRD-PARTY-ICONS.md` (D8) is added at the repo root.

## 11. Testing

There is no test runner. The storage container and the version-2 reader have no
check script today and gain none (they are filesystem- and platform-bound), so
they are covered by the manual matrix below **in addition to** `check-icons.mjs`
and `node scripts/verify.mjs`.

| Observation                                              | Expected                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Open an existing design created before this change       | It opens with its background intact — the v2 reader works; nothing disappears from the gallery.    |
| Insert a gallery photo, move/scale/rotate/flip it         | It behaves like a shape: the selection frame hugs it, handles work, undo/redo covers each step.    |
| Two images in one design, export and re-import           | Both come back, at their positions; the `.midad` is byte-identical in content to a second export.  |
| Delete one image, save, reopen                           | The other image survives; the deleted object's file is gone after the save sweep.                  |
| Export an SVG with an image and an icon                  | The image is an `<image>` and the icon is `<path>` elements — it scales without blur.              |
| PNG export with an image, on web and on device            | The image appears in both; no `offscreen-surface-unavailable` throw.                               |
| Import an icon, change its colour, reopen offline        | The colour persists and the icon draws with no network.                                            |
| Search icons while offline                               | A visible failure message; no crash; the Image block still works.                                  |
| Import a palette-set hit (e.g. an emoji)                 | The row is disabled with a reason and cannot be inserted.                                          |
| Undo a delete of an image                                | The object returns **and** its bytes still render — the sweep on save must not have eaten them.     |

## 12. Code map

| Concern                          | File                                                              |
| -------------------------------- | ----------------------------------------------------------------- |
| Object kinds and version         | `src/storage/project-schema.ts`                                    |
| v2 reader, entry naming, packing  | `src/storage/design-file.ts`                                       |
| Per-asset platform storage        | `src/storage/projects.native.ts`, `src/storage/projects.web.ts`     |
| Export / import / duplicate       | `src/storage/project-io.ts`, `src/storage/import-project.ts`, `src/app/(tabs)/gallery.tsx` |
| Photo picking                     | `src/storage/placed-image.ts`, `src/storage/background-image.ts`    |
| Object box                        | `src/editor/EditorCanvas.tsx` (`objectBox`)                        |
| Canvas render                     | `src/editor/EditorCanvas.tsx`                                      |
| PNG render                        | `src/editor/render/offscreen.ts`                                   |
| SVG render                        | `src/editor/export/svg.ts`                                         |
| Icon identity and allowlist       | `src/theme/icon-sets.ts`                                           |
| Icon body → paths                 | `src/editor/icons/icon-geometry.ts`                                |
| Icon search / download UI         | `src/editor/insert-sheet.tsx`, `src/editor/EditorScreen.tsx`        |
| Insert entry and selected kind    | `src/editor/insert-sheet.tsx`, `src/editor/EditorScreen.tsx`        |
| Opacity and colour availability   | `src/editor/selection-actions.tsx`, `src/editor/EditorScreen.tsx`   |
| Member tile for the new kinds     | `src/editor/collection-bar.tsx`                                    |
| Executable spec                   | `scripts/check-icons.mjs`                                          |
| Licence record                    | `THIRD-PARTY-ICONS.md`                                             |
