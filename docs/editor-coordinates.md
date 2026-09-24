# Editor Coordinates & Fit-to-View

> The four frames the editor works in, how a point crosses between them, and why
> selection chrome is authored the way it is. This is the behavior contract; when
> code and this document disagree, fix the code.

---

## 1. Four frames

Every geometry helper in the editor is expressed in one of four frames. Mixing
them is the single most common source of "the handles are in the wrong place" and
"a rotated object is only selectable near its centre" bugs.

| Frame      | Units              | Origin                         | Used for                                              |
| ---------- | ------------------ | ------------------------------ | ----------------------------------------------------- |
| **View**   | px                 | Top-left of the `<Canvas>` box | Pointer/touch coordinates from gestures               |
| **Design** | design units       | Top-left of the design canvas  | Object `transform.x/y`, alignment, AABBs              |
| **Local**  | object-local units | The object's own centre        | `SizedObject.box`, handle positions, hit-test padding |
| **Visual** | design units       | Top-left of the design canvas  | What the user actually sees (`local × \|scale\|`)     |

Design units equal canvas px — a 1000×1000 canvas is 1000×1000 design units.
Only the **view** frame involves the fit-to-view scale.

`transform.x`/`transform.y` is the object's **centre**, not its top-left. This
falls out of §3 and is relied on by `alignSelected`, the group AABB, and the
rotation maths.

## 2. The canvas transform stack

`EditorCanvas` nests two transforms:

1. **Outer (fit)** — one `<Group transform={[translateX: offsetX, translateY:
offsetY, scale]}>` wrapping everything. Maps design units to view px.
2. **Per-object** — `<Group transform={[translateX: t.x, translateY: t.y,
rotate: rot, scaleX, scaleY]} origin={vec(0, 0)}>`.

`origin={vec(0, 0)}` means rotation and scale happen about the object's own
origin. Object content is authored **centred on that origin** — a paragraph is
painted at `(-w/2, -h/2)`, and shapes/glyphs are wrapped in a group translated by
`-size/2`. So the pivot is the object's centre, which is what makes `x`/`y` a
centre and what lets the selection overlay rotate with the object.

The composed mapping for a point is
$view = design \cdot s + offset$, and for object content
$design = R(\theta) \cdot S(scaleX, scaleY) \cdot local + centre$.

## 3. Fit-to-view

`EditorCanvas` computes, from the measured view box and the canvas size:

$$s = \min\left(\frac{w_{view}}{w_{canvas}}, \frac{h_{view}}{h_{canvas}}\right)$$

then centres the result:

$$offset_X = \frac{w_{view} - w_{canvas} \cdot s}{2}, \qquad offset_Y = \frac{h_{view} - h_{canvas} \cdot s}{2}$$

`min` (not `max`) is what makes the whole design fit rather than fill; the
offsets are the leftover space split in two, which is why the design is centred
and letterboxed. The result is published to the store via `setViewport` and is
the only thing the gesture layer knows about the view.

When the view box is not yet measured (`null`, or zero width/height), the memo
returns `scale: 1, offsetX: 0, offsetY: 0` — the pre-layout default, not a
correct mapping. Anything that runs before layout must tolerate it.

## 4. Crossing frames

Two conversions, both exact inverses:

| Direction      | Helper                                          | Formula                                                           |
| -------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| View → Design  | `toDesign(x, y)` (`use-object-gestures.ts`)     | $((x - offset_X)/s,\ (y - offset_Y)/s)$                           |
| Design → Local | `toLocalPoint(transform, x, y)` (`hit-test.ts`) | Undo translate, undo rotation ($-\theta$), divide by signed scale |

`toDesign` reads the viewport from the store imperatively. `toLocalPoint` divides
by `flipH ? -scale : scale` per axis, so a flipped object's local frame is
mirrored and a box expressed in local units can be tested against it directly.

**`toLocalPoint` is shared by the hit-test and the gesture layer on purpose.**
Both the tap path and the pointer-down drag path must agree about where an
object's box is — including when it is scaled, flipped or rotated. If you need
this mapping, import it; do not re-derive it.

`toLocalPoint` is not a general frame conversion: it maps into the object's
_unrotated, unscaled_ frame, so a design-space offset of N units becomes N/scale
local units. Local units are the frame to use when the quantity should scale with
the object (its box, its handles); design units are the frame to use when it
should not (chrome thickness — see §6).

## 5. Boxes

`SizedObject.box` is measured in **local** units, unscaled. `EditorCanvas`
produces it per type:

- **text** — `textObjectSize(layout, fontSize, wrapWidth)`, from the shaped
  paragraph (see `docs/editor-text-engine.md`)
- **shape / glyph** — a `SHAPE_BASE_SIZE` (120) square. The object's transform
  group supplies the scale, so including it here would apply it twice.

To get the object's **visual** extent in design units — what the renderer and the
overlay actually draw — use:

```ts
visualHalfExtents(o); // { hw: (box.width / 2) * |scale|, hh: … }
```

`objectAabb(o)` widens that to contain the _rotated_ visual box
($e_x = hw|\cos\theta| + hh|\sin\theta|$, $e_y = hw|\sin\theta| + hh|\cos\theta|$),
and `groupAabb(objects)` unions several. Alignment and centring must use these
rather than the raw box, otherwise they disagree with what the user sees on a
scaled object.

### The ink box

A text object's `box` is the paragraph's **advance/line** box: it includes the
side bearings and the line height, so it can be far wider and taller than the
drawn glyphs. A **split word's part** therefore carries an additional tight `ink`
box — `{ cx, cy, width, height }`, the glyph bounds in the same local frame,
measured from `paragraph.getRectsForRange` (`skia/text.ts`).

Hit-testing, the collection frame, alignment and the single-object chrome use
`ink` when it is present; **painting and export keep `box`**, so the glyphs never
move. `cx`/`cy` are the ink _centre_, because the ink is not necessarily centred
on the object origin (text alignment, side bearings); `objectCentre(o)` maps it
through the object's flip, scale and rotation, and `pickHandle` takes the same
offset so the drawn chrome and the grabbed handles agree
([`editor-split-and-rejoin.md`](editor-split-and-rejoin.md) §4).

## 6. Chrome is authored in screen pt

Selection chrome must stay a **constant size on screen**. It is drawn inside the
object's transform group, so it inherits both the view scale and the object's own
scale. Everything the chrome needs therefore goes through one factor, `unit` —
the number that maps the frame the chrome lives in to screen pt:

| Chrome drawn                                      | `unit`                                 |
| ------------------------------------------------- | -------------------------------------- |
| Inside one object's transform group               | `scale * safeObjectScale(objectScale)` |
| A sibling of the objects (collection frame, grid) | `scale`                                |

```ts
const unit = scale * safeObjectScale(objectScale);
const border = 1.5 / unit;
const handleR = 5 / unit;
```

`safeObjectScale(s)` is `Math.max(MIN_OBJECT_SCALE, Math.abs(s) || 1)` with
`MIN_OBJECT_SCALE = 0.05`; `safeUnit(u)` is the same trick with `MIN_UNIT = 0.02`.
Both share a quirk worth knowing: a value of exactly `0` maps to **1** via `|| 1`
(an unmeasured view reports `scale: 1`, and a zero-scaled object is treated as
unscaled), while a tiny _non-zero_ value floors at the minimum. A near-zero scale
is not a supported state, but it will not produce `Infinity` either.

**Every chrome length below is the size the user sees**, and the helpers divide
`unit` out on the way into a frame's own units:

| Constant               | Screen pt | Meaning                       |
| ---------------------- | --------- | ----------------------------- |
| `SELECTION_HANDLE_PAD` | `6`       | Box edge → handle centre      |
| `ROTATE_HANDLE_GAP`    | `30`      | Box top edge → rotate grip    |
| `HANDLE_TOUCH_RADIUS`  | `22`      | Touch target around a handle  |
| `ROTATE_TOUCH_RADIUS`  | `26`      | Touch target around the grip  |
| `OBJECT_HIT_PAD`       | `10`      | Grab tolerance around the box |
| `MEMBER_HIT_PAD`       | `4`       | Grab tolerance around an ink part |

`selectionPad(unit)` is `SELECTION_HANDLE_PAD / unit` and `rotateGap(unit)` the
same for the gap. Both are shared by the canvas overlay _and_ the gesture
hit-test, which is what stops the rotate grip from crowding — and swallowing —
the resize handles on a scaled-down object.

**Authoring these in design units was a real bug, and it cost the whole
Android/iOS experience.** A 1080-unit canvas on a 390pt phone fits at a view
scale of ≈0.27–0.3, so a 4-unit pad put the drawn handles ~1.2pt off the box
corner and a 12.7-unit touch radius gave a **~7pt** target: the handles landed
on the border, and pressing them missed or fell through to the object body. Web
was unaffected only because the pointer there is a mouse. Four constants moved
(`4 → 6`, `26 → 30`, plus two new touch radii) and the assertions are locked in
screen pt by `scripts/check-handles.mjs`.

**Chrome drawn in the outer group divides by `scale` only.** `CollectionOverlay`
(`1.5 / scale`) and `GridOverlay` (`1 / scale`) are siblings of the objects, not
children of an object's transform, so the object scale never applies to them.
Getting this backwards is the usual cause of chrome that grows with an object.

**The collection frame is the reason the collection chrome sits in the outer
group.** A collection has no transform of its own to nest inside, so its box is
_derived_ (`groups.ts` `collectionFrame`) and expressed in design units, with the
member scales already folded into its half-extents. That is what makes it behave
exactly like chrome drawn in the outer group: no object scale to divide out, one
`1 / scale` conversion for every length. Its orientation comes from the members'
shared rotation, or 0 when they disagree
([`editor-collections.md`](editor-collections.md) §3).

## 7. Handle geometry

`resizeHandles(box, unit)` returns the eight handles in the frame's own units,
centred on the origin:

- corners and edges at $\pm(box.w/2 + pad)$, $\pm(box.h/2 + pad)$, where
  `pad = selectionPad(unit)`
- `rotateHandle(box, unit)` sits at $(0, -(box.h/2 + pad + rotateGap))$

Both are imported by the canvas overlay _and_ the gesture hit-test, so the drawn
handles and the tappable handles are the same numbers. `isCornerHandle`,
`isHorizontalHandle` and `isRotateHandle` classify them for the resize maths
(corners scale proportionally, `e`/`w` re-flow text, `n`/`s` scale font size).

### What a press grabs

`pickHandle(transform, box, unit, p)` owns that decision, in one copy — the
gesture layer calls it for a single object and for a whole selection's frame,
and passes an `offset` when the box is an ink box not centred on the object
origin, so the press is measured from the ink centre and the drawn handles are
translated by the same vector. Three rules, in order:

1. **The rim rule.** A resize handle is a candidate only when the press is in
   the box's outer band: $\max(|l_x| / (w/2),\ |l_y| / (h/2)) \ge 0.55$
   (`RIM_FRACTION`). The touch radii are deliberately far larger than the drawn
   handles — a 44pt target swallows a small object whole — so without this rule
   a press in the middle of an object would resize it instead of moving it. It
   is a _fraction_, not a length, so it behaves identically at every zoom. The
   rotate grip sits outside the box, so it clears the test on its own.
2. **Tiers.** `rotate` → corners → edges. The grip can never be shadowed by a
   resize handle, and a corner always beats an edge — otherwise a press on a
   short object's corner would grab `e` and re-flow its text instead of scaling
   it.
3. **Nearest wins** within the winning tier.

`pickObject(objects, x, y, unit)` does the same job for whole objects: front to
back, the first object whose **ink box** (or `box` when it has no ink) grown by a
grab tolerance contains the point wins. The tolerance is
`OBJECT_HIT_PAD / (unit * |scale|)` in general, tightened to
`MEMBER_HIT_PAD / (unit * |scale|)` for an ink-hugging split part — its
neighbours sit close, and the full pad would let one steal the press. Both pads
are screen lengths like the rest, so the tolerance a thin text line gets does not
depend on the zoom. It is the one object-hit rule, shared by the tap path and the
pointer-down drag path, so both accept the same press.

## 8. Measuring the canvas

`<Canvas>` is sized by the plain `View` wrapper around it, **never** by
`<Canvas onLayout>` — Skia dropped that prop on the new architecture (Fabric),
where it is ignored and only logs an error. Measuring the wrapper is equivalent
(the Canvas fills it) and works on Fabric and react-native-web alike.

Without a measured size, the fit maths stays at `scale: 1` and the design paints
1:1 from the top-left corner. This is a silent failure: no exception, just a
wrong-looking canvas.

The `onLayout` handler also returns the previous state object when `w`/`h` are
unchanged, because `onLayout` re-fires on unrelated layout passes and a new state
object would re-run the fit memo, the viewport effect, and every object layer.

## 9. Code map

| Concern                                                           | File                                  |
| ----------------------------------------------------------------- | ------------------------------------- |
| `SizedObject`, `toLocalPoint`, `hitTest`, `pickObject`            | `src/editor/hit-test.ts`              |
| `objectAabb`, `groupAabb`                                         | `src/editor/hit-test.ts`              |
| `safeUnit`, `safeObjectScale`, `selectionPad`, `rotateGap`        | `src/editor/hit-test.ts`              |
| `resizeHandles`, `rotateHandle`, `pickHandle`, handle classifiers | `src/editor/hit-test.ts`              |
| Fit-to-view memo, viewport publish, wrapper measurement           | `src/editor/EditorCanvas.tsx`         |
| Per-object transform group, content centering, chrome division    | `src/editor/EditorCanvas.tsx`         |
| `toDesign`, drag translation division                             | `src/editor/use-object-gestures.ts`   |
| Text box measurement (`textObjectSize`)                           | `src/editor/skia/use-text-layouts.ts` |
| Alignment maths consuming visual extents                          | `src/editor/align.ts`                 |
| Screen-pt regression checks                                       | `scripts/check-handles.mjs`           |
