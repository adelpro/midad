# Render Contract: Canvas, PNG & SVG

> How the three renderers stay in agreement, and what each one does differently.
> This is the behavior contract; when code and this document disagree, fix the
> code.

---

## 1. Three renderers, one visual truth

The same document is painted three ways. They are separate code paths — two
declarative/imperative Skia surfaces and one string serializer — so keeping them
aligned is a contract, not an accident.

| Renderer        | Entry point                                  | Mechanism                       | Output                      |
| --------------- | -------------------------------------------- | ------------------------------- | --------------------------- |
| **Live canvas** | `EditorCanvas` / `ObjectLayer`               | Declarative Skia JSX            | What the user edits         |
| **PNG**         | `renderProjectToPng` (`render/offscreen.ts`) | Imperative `SkCanvas` offscreen | Base64 `data:image/png` URI |
| **SVG**         | `projectToSvg` (`export/svg.ts`)             | String serialization            | Standalone `.svg` text      |

The PNG path is used for both **thumbnails** (`maxWidthPx: THUMB_MAX_WIDTH_PX`, 360) and image export (`maxWidthPx: 2048`, the default).

## 2. What all three share

These are imported by every renderer. Changing them changes all three at once —
which is the point.

| Shared symbol                         | Runs                                | Contract                                                     |
| ------------------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `SHAPE_BASE_SIZE` (`120`)             | geometry & each object's box        | The square a shape or glyph is authored into, in local units |
| `SHAPE_INSET` (`8`)                   | circle, square, octagon, diamond, … | Clearance between ink and box edge — see §3                  |
| `SHAPE_PATH_BUILDERS`                 | every non-primitive shape           | The one path table (see §4)                                  |
| `glyphPlacement(entry, size)`         | glyphs                              | Aspect-fit + recentre, as one scale + translate pair         |
| `drawShapeOnCanvas` / `ShapeRenderer` | shapes                              | Imperative / declarative pair                                |
| `drawGlyphOnCanvas` / `GlyphRenderer` | glyphs                              | Imperative / declarative pair                                |

`SHAPE_INSET` exists because box-filling shapes used to run flush to the edge,
leaving a stroked circle touching its own selection rectangle (and spilling a
unit past it). Every shape now keeps that much air, so an ornament reads as
sitting inside its box rather than as a box that happens to be round.

## 3. The per-object transform convention

All three apply the same four operations, in the same order, about the object's
**centre** (`transform.x`/`y`):

$$translate(x, y) \;\to\; rotate(\theta) \;\to\; scale(s_x, s_y)$$

where $s_x$ and $s_y$ are the signed scales (`flipH ? -scale : scale`).

In SVG this is the single attribute
`translate(x y) rotate(deg) scale(sx sy)`; in Skia it is the `transform` array on
`ObjectLayer`'s `<Group origin={vec(0, 0)}>`; in the PNG path it is
`c.translate` → `c.rotate(deg, 0, 0)` → `c.scale`.

Because content is authored **centred on the origin** (a paragraph at
`(-w/2, -h/2)`; shapes and glyphs inside a group shifted by `-size/2`), each
renderer's per-type branch has the same shape:

- **canvas** — `<Paragraph x={-box.width / 2} y={-box.height / 2}>`, or a `<Group
translateX: -box.width/2 translateY: -box.height/2>` wrapping the shape/glyph
  renderer
- **PNG** — `paragraph.paint(c, -width/2, -height/2)`, or
  `c.translate(-SHAPE_BASE_SIZE / 2, -SHAPE_BASE_SIZE / 2)`
- **SVG** — `<text x="0" y="0" …>` with `<tspan>`s, or
  `<g transform="translate(-60 -60)">`

Note that shape/glyph boxes are **always** `SHAPE_BASE_SIZE`, not a measured box:
the object's transform group supplies the scale, so including it in the box would
apply it twice.

## 4. Opacity is a layer, never a colour

Every renderer composites an object through an alpha layer when `opacity < 1`,
and skips the layer entirely at full opacity:

| Renderer | Mechanism                                                        |
| -------- | ---------------------------------------------------------------- |
| canvas   | nested `<Group opacity={opacity}>`, omitted when `opacity === 1` |
| PNG      | `c.saveLayer(layerPaint)` with `setAlphaf(opacity)`              |
| SVG      | `opacity="…"` attribute on the object's `<g>`, omitted at `1`    |

It is never baked into the object's colours. That is what lets opacity change
without re-shaping a paragraph — the text layout signature deliberately excludes
`opacity` (see `docs/editor-text-engine.md` §6). The canvas also keeps the
selection chrome outside the faded group, so handles stay fully opaque.

## 5. Adding a shape = add one builder

The three renderers each have a `switch (shapeKey)`, but only four keys are
primitives drawn natively by all three (`circle`, `square`, `ring`, `line`).
**Every other shape falls through to `SHAPE_PATH_BUILDERS[shapeKey]`** in the
default branch.

So adding a path shape is:

1. add the key to the `ShapeKey` union in `src/storage/project-schema.ts`
   (`ShapeKey` lives in the schema, not the renderer, because three renderers plus
   the library UI switch on it)
2. add one `(size: number) => string` builder to `SHAPE_PATH_BUILDERS`
3. add it to the library sheet's list

No renderer changes. The builders return SVG path strings, which is why one table
can feed declarative Skia (`<Path path={build(size)}>`), imperative Skia
(`Skia.Path.MakeFromSVGString(build(size))`) and raw SVG (`<path d="…">`)
identically. Before this table existed the three renderers repeated the same
switch, and a new shape could land in one and be missing from the other two.

Builders that need a curved outline (`crescent`, `arch`) use SVG arc commands
rather than sampled points, so the two Skia paths and the SVG path agree exactly
instead of within a rasterization tolerance.

**Unknown keys degrade the same way everywhere**: the canvas renders an empty
`<Group />`, the PNG path returns without drawing, and the SVG serializer returns
`null` so the object is skipped. A project referencing a retired shape or glyph
still loads and simply renders nothing. `getGlyphEntry` returning `null` is the
same story for glyphs.

## 6. Fill/stroke visibility

An object is invisible when `!fill && strokeWidth <= 0`. All three implement it:

- canvas — `if (!shape.fill && strokeWidth <= 0) return null`
- PNG — `fillOrStrokePaint` returns `null`, and each case returns early
- SVG — `shapePaintAttrs` returns `null`, and the geometry function returns `null`

`ring` and `line` are stroke-only by nature and **double** the width
(`(strokeWidth ?? 2) * 2`) so they read at the same weight as a stroked shape at
the same nominal value.

## 7. Background

| Mode          | Canvas                             | PNG                                      | SVG                                            |
| ------------- | ---------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| `paper`       | `<Rect>` with `color ?? "#F7F6F3"` | `drawRect` same colour                   | `<rect fill>` same colour                      |
| `transparent` | `<Rect color="transparent">`       | **skipped** (`c.clear` transparent)      | no background element at all                   |
| `image`       | `<SkiaImage fit="cover">`          | manual cover: `max(W/iw, H/ih)` + centre | `<image preserveAspectRatio="xMidYMid slice">` |

`slice` is SVG's "cover", so all three crop rather than letterbox. Only the
canvas has a transient state: `useImage` decodes asynchronously and returns
`null` until ready, so the first frame paints a white `<Rect>` and the image pops
in. The exports have no equivalent — they decode synchronously and fall back to
white only on failure (PNG) or keep the reference (SVG, which the viewer
resolves).

## 8. Where SVG genuinely differs

SVG is the one renderer that cannot fully control its output, and the differences
are deliberate:

**Text is emitted as real `<text>`**, not paths. It renders correctly in any
viewer that honours the embedded `@font-face`, but **a desktop design tool that
substitutes fonts will render it differently**. The canvas and PNG shape the text
themselves and cannot have this problem. This is the accepted trade for
selectable, editable, resolution-independent text.

**SVG cannot re-flow a string.** Soft-wrapped text therefore needs the caller to
supply `lineBreaks` — a map of object id to visual lines from `textLineBreaks`.
When it is absent, only explicit newlines (`obj.text.split("\n")`) are honoured,
so a narrowed text box would export as one long line. The callers in
`EditorScreen` compute it; a new export path must too.

**Text outlines were removed.** `outline` used to be rendered by `textToSvg`
alone (`stroke` + `paint-order="stroke"`, which paints the stroke under the fill
so it does not eat into the glyph shapes), while the canvas and PNG paths carried
the field into `layoutArabicText` without `buildParagraph` ever reading it — so
the three paths disagreed about any document that set it. The field and the SVG
branch are both gone and the renderers now agree by construction; see
`docs/editor-text-engine.md` §7.

**Shadows become `feDropShadow` filters.** A multi-shadow preset chains several
primitives inside one `<filter>` (which is how `engraved` survives), the filter
region is inflated to `-50% / 200%` so large blurs are not clipped at the text
box, and `rgba()` shadow colours are split into `flood-color` + `flood-opacity`
because not every renderer honours alpha inside `flood-color`. Filter ids are
derived from the object id with anything non-id-safe folded to `-`, since object
ids are not guaranteed to be XML-id-safe.

**Fonts are embedded as base64 TTFs** via `collectUsedFamilies` →
`collectSvgFontFaces`. On web, Metro resolves the font asset to a URI that is
fetched; on native the `require()` id goes through `expo-asset` and
`expo-file-system`. **An unembeddable family is silently skipped** — the export
succeeds and the viewer falls back to a substitute font. `familyForKey` also
falls back to `Amiri` for an unknown key.

## 9. PNG specifics

- The longest side is scaled to `maxWidthPx` (default `2048`); width and height
  are rounded and floored at 1. The whole design is then drawn under one
  `c.scale(s, s)`, so the document's design units are untouched.
- Rasterize offscreen, `makeImageSnapshot`, `encodeToBase64`. Throws on:
  `fonts-not-loaded` (text present but no font provider),
  `offscreen-surface-unavailable`, and `png-encode-failed`.
- It re-shapes text from scratch via `layoutArabicText(...)` and **disposes the
  paragraph immediately** after painting. This is safe here — unlike the live
  canvas, nothing else holds the handle.
- One exception to the alpha-layer rule: the background is painted under
  `c.save()`/`c.scale(s, s)` before the objects, and skipped entirely for
  `transparent`.

## 10. Keeping them in sync

When you touch one renderer, check the other two for its per-type branch and its
`switch`. The failure mode is silent: an object that renders on the canvas but is
missing from the export, or a shape that scales on screen but not in the PNG.
There is no automated check for this — the shared tables in §2 exist to make the
common case (a new path shape) impossible to get wrong.

## 11. Code map

| Concern                                                                      | File                                |
| ---------------------------------------------------------------------------- | ----------------------------------- |
| Live canvas, object layers, transform groups, chrome                         | `src/editor/EditorCanvas.tsx`       |
| PNG rasterizer, background cover, error codes                                | `src/editor/render/offscreen.ts`    |
| SVG serializer, `@font-face`, filters, escapes                               | `src/editor/export/svg.ts`          |
| `SHAPE_BASE_SIZE`, `SHAPE_INSET`, `SHAPE_PATH_BUILDERS`, `drawShapeOnCanvas` | `src/editor/skia/shape-geometry.ts` |
| Declarative shape renderer                                                   | `src/editor/skia/shapes.tsx`        |
| Glyph renderer, `glyphPath` cache, `drawGlyphOnCanvas`                       | `src/editor/skia/glyph-shape.tsx`   |
| `getGlyphEntry`, `glyphPlacement`, `glyphViewBox`                            | `src/editor/glyphs/index.ts`        |
| Generated glyph path catalog                                                 | `src/editor/glyphs/catalog.ts`      |
| Text shaping used by canvas and PNG                                          | `src/editor/skia/text.ts`           |
| `textLineBreaks` for the SVG exporter                                        | `src/editor/skia/text.ts`           |
| Thumbnail sizing constant                                                    | `src/storage/thumbs.ts`             |
