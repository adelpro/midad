# Editor Text Engine

> How Arabic text is shaped, measured, memoized and disposed. This is the
> behavior contract; when code and this document disagree, fix the code.

---

## 1. ParagraphBuilder + HarfBuzz is the only correct path

midad renders text through Skia's **Paragraph API** (`Skia.ParagraphBuilder`),
never through the simple `<Text>` component:

> The ParagraphBuilder uses HarfBuzz shaping, so Arabic renders with correct
> contextual forms (initial/medial/final), lam-alef ligatures, and RTL direction.
> The simple Skia `<Text>` component does NOT shape Arabic, so this is the only
> correct path.

Arabic is a cursive script: a letter's glyph depends on its neighbours. Without
shaping you get isolated forms in a disconnected row. Any new text-rendering code
must go through `layoutArabicText` / `Skia.ParagraphBuilder`.

Two parameters are set on the builder from the text itself:

| Setting         | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| `textDirection` | `RTL = 0` when `/[\u0600-\u06FF]/.test(text)`, else `LTR = 1`  |
| `textAlign`     | `Center = 2` / `Right = 1` / `Left = 0` — the **numeric** enum |

The paragraph style is authored with the numeric enums because the string
literals are not accepted here.

## 2. Fonts: a provider is mandatory

`loadParagraphFonts()` loads every family in `fontAssets` into a
`SkTypefaceFontProvider`; `useParagraphFonts()` is its render-time wrapper,
holding the provider in state until it resolves. The provider is then passed to
the builder.

`toFontSource` normalizes the Metro asset shape, which differs by platform:

- **native** — `require()` yields a numeric asset id, passed through as-is
- **web** — Metro resolves the asset to a URI **string**, which Skia's
  `resolveAsset` cannot handle, so it is wrapped as `{ uri, width: 0, height: 0 }`

The provider is **mandatory on web**, which has no system font manager. On native
it also guarantees the bundled calligraphy fonts are used rather than a system
substitute. Until it resolves, `useTextLayouts` returns a stable empty map
(`EMPTY_LAYOUTS`) — text objects render nothing rather than crashing.

### The web CanvasKit gate is a hard boundary

Skia's web singleton captures `global.CanvasKit` at **module-evaluation** time:
`export const Skia = JsiSkApi(global.CanvasKit)`. If any module in the startup
graph is evaluated before `LoadSkiaWeb` runs, that `Skia` holds an undefined
CanvasKit forever, and the first Skia call throws
`can't access property "Typeface", this.CanvasKit is undefined`.

That is why `src/app/editor.tsx` only re-exports a host whose `.web` variant
loads CanvasKit through `WithSkiaWeb`, and why the gallery — the web landing
route — must not statically import this module or hook `useParagraphFonts` at
render time. The gallery reaches Skia only through
`renderImportedThumbnail` (`src/editor/render/thumbnail-on-demand.ts`), which
loads CanvasKit on demand inside the import handler and then dynamic-imports the
font loader. Anything that needs Skia from a non-editor route must follow the
same on-demand (or `WithSkiaWeb`-gated) shape; a static import in the route is
the bug.

An unknown `fontKey` falls back to `Amiri` (`Object.hasOwn(fontAssets,
spec.fontKey) ? … : "Amiri"`), so a project referencing a retired font still
renders.

## 3. Auto width is a two-pass measure

When `wrapWidth` is `null`, the box hugs the text:

1. **Probe pass** — shape the paragraph at `AUTO_TEXT_WIDTH` (`100000`), wide
   enough that nothing soft-wraps, and read `getLongestLine()` for the intrinsic
   width.
2. **Real pass** — shape again at the resolved width.

The resolved width is `Math.max(MIN_TEXT_WIDTH, Math.ceil(Math.min(intrinsic,
maxWidth)))`:

| Step                    | Why                                                                                                                                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Math.min(…, maxWidth)` | an over-long line wraps at the canvas edge instead of running off it                                                                                                                                                                                              |
| `Math.ceil(…)`          | **Skia truncates the layout width to an integer.** A float width from `getLongestLine()` collapses to `floor(width)` and wraps the very line it was measured from — which showed up as every auto-width text sitting on two lines in a box that looked too narrow |
| `MIN_TEXT_WIDTH` (`1`)  | keeps an empty paragraph selectable                                                                                                                                                                                                                               |

A manual `wrapWidth` (set by a horizontal resize) always wins and skips the probe
— so dragging a text handle **re-flows** the glyphs instead of scaling them.

The paragraph is then shaped at **exactly** the resolved width, which is also the
object's box width. `RenderedParagraph.width` is that number, and painting uses
it, so the glyphs can never disagree with the box. Shaping the box at the canvas
width while laying the glyphs out at the box width used to let centred text sit
off-centre and let the measured height drift from the painted one.

## 4. Optional style keys must be ABSENT, not `undefined`

This is the trap that only ever failed on device.

The native style reader guards every field with `hasProperty(...)`, which is
**true for a key that exists and holds `undefined`**. It then converts that value
as an object and throws:

```
Value is undefined, expected an Object
```

Most text objects carry no shadows — `shadows` is optional and the `classic`
preset clears it — so passing the key unconditionally broke shaping on native
only. CanvasKit (web) tolerates the `undefined`, which is why this never showed
up in a browser.

**The pattern:** build the style object with required keys only, then attach
optional ones when non-empty.

```ts
const style: SkTextStyle = { fontFamilies, fontSize, heightMultiplier, color, fontStyle };
if (spec.shadows?.length) {
  style.shadows = spec.shadows.map(…);
}
```

Any new optional `SkTextStyle` field must follow this. Never write
`{ someOptional: valueOrUndefined }`.

Also note `heightMultiplier` is `lineHeight / fontSize` — the style takes a
multiplier, while the document stores an absolute line height in design units.

## 5. Layouts are memoized on a layout signature

`useTextLayouts` keys its memo on a **string signature**, not the objects array:

```
canvasWidth \0 id \1 text \1 fontKey \1 fontSize \1 lineHeight \1
align \1 wrapWidth \1 color \1 outline \1 shadows \0 …
```

The signature **deliberately excludes `transform`, `zIndex` and `opacity`**.
Moving, scaling or fading an object cannot alter its shaping, so those edits must
never trigger a rebuild. This is what keeps dragging cheap once a design holds
many small text objects — notably a word split into per-cluster parts.

Because the memo depends on the signature, a gesture that only moves objects
returns the **referentially identical** map, so nothing downstream re-memoizes in
`EditorCanvas`. Depending on the array identity instead would re-shape every
paragraph on every frame of a drag, since a transform patch produces a new array.

`color` **is** in the signature. That is conservative — colour changes do not
affect shaping, only painting — and the effect is a re-shape on a colour change,
which is rare and cheap. Do not "optimize" it out without measuring.

The `useMemo` dependency list is `[signature, fonts, canvasWidth]` with a
targeted `eslint-disable-next-line react-hooks/exhaustive-deps`: `objects` is read
from the render closure, and any layout-relevant change to it changes the
signature, so the memo still observes current values.

## 6. Paragraphs are native handles — dispose after TWO frames

Each `RenderedParagraph` wraps a `SkParagraph`, a native object that must be
freed. **When** it is freed matters:

Disposing synchronously in the commit effect is **too early**. Skia's renderer
draws on its own frame loop, so a paragraph freed in this commit's effect can
still be handed to CanvasKit by a frame already in flight:

```
Cannot pass deleted object as a pointer of type Paragraph*
```

That is not a one-off. An exception thrown mid-draw leaves the failed command in
Skia's **retained queue**, so the same stale paragraph is retried on every
subsequent frame and the log floods.

A single stepper tap rarely wins that race. A drag re-lays out on every frame —
exactly what the font-size gauge does — and hits it reliably. So the wait must
clear a _whole_ frame: **the first `requestAnimationFrame` lets Skia draw the
generations that replaced these; the second frees them** once that draw has
certainly happened. Retention stays bounded at ~two frames' worth.

The mechanism:

| Ref            | Holds                                                         |
| -------------- | ------------------------------------------------------------- |
| `previousRef`  | The newest generation, still live                             |
| `pendingRef`   | Generations awaiting disposal (a **queue**, not a single one) |
| `flushPending` | Frees every queued generation                                 |

The effect cleanup cancels the pending rAFs. That is safe: cancelling drops the
queued _callbacks_, not the generations, so the next flush still frees everything.
A separate unmount effect flushes the queue **and** disposes the still-live
current generation, so nothing leaks when the editor closes.

Note the guard `previous && previous !== layouts` — replacing the map with the
same reference must not queue a duplicate generation.

The PNG renderer is the exception: it shapes its own paragraphs and disposes each
immediately after painting, because nothing else holds that handle.

## 7. `outline` was removed, not implemented

`CalligraphyTextObject.outline` and `TextLayoutSpec.outline` used to exist, and
they were a trap. The field was plumbed through `layoutArabicText`,
`useTextLayouts` and `renderProjectToPng`, it participated in the layout
signature (so changing it re-shaped paragraphs for no visual effect), and it was
**never read by `buildParagraph`**. Only `projectToSvg` rendered it, and nothing
in the UI ever set it — across the codebase it was only _copied_, by split and
merge. So an outline could exist only in a hand-authored or imported document,
where it was visible in the SVG export and invisible on the canvas and in a PNG.

The field is now **gone end-to-end**, together with the SVG `stroke` +
`paint-order="stroke"` branch, so all three renderers agree again. A project file
that still carries an `outline` key loads and simply ignores it.

Re-adding it means implementing it on the Skia paths as well (an
`SkTextStyle.foreground` paint) so canvas, PNG and SVG land together.

## 8. Extracting visual lines

`paragraphLines(paragraph, text)` returns the visual lines of a laid-out
paragraph, soft wraps included. Line offsets come back as **UTF-16 code-unit
indices**, so the function does not trust them blindly:

1. Map each metric to `text.slice(m.startIndex, m.endExcludingWhitespaces ??
m.endIndex)`.
2. **Verify** that `strip(lines.join("")) === strip(text)` (whitespace removed).
3. On mismatch — or on any throw — return `null`, so callers fall back to the
   object's explicit newlines.

Returned lines are trimmed and empties are dropped. The verification step exists
because the offset units differ on some platforms, and a silently wrong slice
would produce an export that looks plausible and is wrong.

`textLineBreaks(project, fonts)` runs this for every text object and returns a
`Record<objectId, string[]>`. It is required by the **SVG exporter**, which cannot
re-flow a string on its own (see `docs/editor-render-contract.md` §8). It lays
each object out with `maxWidth: project.canvas.width` and disposes the paragraph
immediately. It deliberately passes no `shadows` — line breaks do not depend on
them.

## 9. Sizing a text object

`textObjectSize(layout, fontSize, wrapWidth)` gives the hit-test box:

| Field    | Value                                           |
| -------- | ----------------------------------------------- |
| `width`  | `layout.width` ?? `wrapWidth` ?? `fontSize × 2` |
| `height` | `layout.height` ?? `fontSize × 1.2`             |

The layout already carries the resolved box width (hugged, wrapped or capped at
the canvas), so it is used as-is. The fallbacks only apply before fonts load —
they keep an object selectable rather than collapsing it to zero.

## 10. Code map

| Concern                                                   | File                                       |
| --------------------------------------------------------- | ------------------------------------------ |
| `layoutArabicText`, `buildParagraph`, `resolveTextWidth`  | `src/editor/skia/text.ts`                  |
| `loadParagraphFonts`, `useParagraphFonts`, `toFontSource` | `src/editor/skia/text.ts`                  |
| On-demand web CanvasKit load + one-off thumbnail render   | `src/editor/render/thumbnail-on-demand.ts` |
| `paragraphLines`, `textLineBreaks`                        | `src/editor/skia/text.ts`                  |
| `TextLayoutSpec`, `RenderedParagraph`, the constants      | `src/editor/skia/text.ts`                  |
| `useTextLayouts`, `layoutSignature`, disposal queue       | `src/editor/skia/use-text-layouts.ts`      |
| `textObjectSize`                                          | `src/editor/skia/use-text-layouts.ts`      |
| Text objects painted on the canvas                        | `src/editor/EditorCanvas.tsx`              |
| Offscreen re-shaping + immediate dispose                  | `src/editor/render/offscreen.ts`           |
| Font registry and calligraphy families                    | `src/theme/fonts.ts`                       |
| Style presets that patch these fields                     | `src/theme/presentations.ts`               |
