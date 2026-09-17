# Editor Gestures

> The canvas gesture pipeline: composition, pointer-down resolution, drag,
> resize, rotation and the release settle. This is the behavior contract; when
> code and this document disagree, fix the code.

---

## 1. Composition

```ts
Gesture.Race(tap, Gesture.Simultaneous(pan, pinch, rotate));
```

One tap races a simultaneous pan/pinch/rotate trio. The composition is built
inside a `useMemo` keyed on `[selectEnabled, reduceMotion]` — **rebuilding it
every render used to hand RNGH a new gesture object on every animation frame of a
drag.**

**Every handler hops to the JS thread immediately with `runOnJS`.** No worklet
holds or reads JS-thread state; all mutation goes through zustand on JS. Keeping
that rule is what makes the gesture layer safe under the React Compiler.

| Gesture    | Events used                                                            | Handlers                                               |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `Tap`      | `.maxDuration(220)`, `.onEnd`                                          | `handleTap`                                            |
| `Pan`      | `.minDistance(2)`, `.onBegin` / `.onUpdate` / `.onEnd` / `.onFinalize` | `beginDrag` / `updateDrag` / `endDrag` / `clearResize` |
| `Pinch`    | `.onStart` / `.onUpdate` / `.onFinalize`                               | `beginTransform` / `applyPinch` / `clearResize`        |
| `Rotation` | `.onStart` / `.onUpdate` / `.onFinalize`                               | `beginTransform` / `applyRotation` / `clearResize`     |

### Why pan resolves at `onBegin`

`minDistance(2)` exists **only to filter jitter** — translation is still measured
from the touch-down point, so tracking stays 1:1.

The grab is resolved at pointer-down, not after the threshold, because a handle
must be caught **where the finger lands**, and the resize/rotate baselines are
measured from that exact point. Resolving later would mean the first 2px of
movement are invisible to a handle drag that needs them.

### The tap path

`Tap.onEnd` → `handleTap(e.x, e.y)` → `toDesign` → a **module-level `tapRelay`** →
`setTapPoint` in the hook → returned as `tapPoint` → `EditorCanvas` runs a
`hitTest` in an effect → `onTapResult`. The relay exists to keep the worklet side
free of local state.

`EditorCanvas` keys that effect on `tapPoint` **alone** and reads `sized` and
`onTapResult` through refs: both get new identities on most renders, so keying on
them would loop a hit-test plus selection write every frame instead of firing once
per real tap.

## 2. Pointer-down: the `beginDrag` decision table

Handles exist around a single object only (a multi-selection shows one plain
group box), so a handle drag is never ambiguous. Otherwise pointer-down decides
the selection.

Let `additive = multiSelectMode || isAdditiveSelectionModifier()`, and
`alreadySelected = selectedIds.includes(hit.id)`:

| Situation                                     | Result                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `enabled === false`                           | Reset the scratch flags and return — no selection, no drag                                                           |
| Pointer on a handle of a **single** selection | Start a resize/rotate: capture the origin bundle, `hapticTick()`, `snapshot()`                                       |
| Pointer on **empty** space                    | Clear the scratch; if something was selected, `select(null)` and mark `selectionHandledOnDown`                       |
| `additive` **and** on an unselected object    | **Add it, do not drag it** — an imprecise tap must not nudge the object                                              |
| On an **already-selected** object             | Drag the whole selection; a quick tap (no drag) toggles it off via the tap handler — the multi-select deselect idiom |
| `additive` off, on an unselected object       | Replace the selection, then drag it                                                                                  |

The last two branches capture `dragOrigins` (one entry per selected object) and
set `selectionHandledOnDown: !alreadySelected`, then `snapshot()`.

`select` resolves the press to the whole **element** the pointer landed on — the
object plus its group — so `alreadySelected` is true for any member of the current
group and the drag moves the group. The origins are read back from the store
**after** that write, never from the snapshot `beginDrag` opened with: the
snapshot predates the selection change, so using it would drag the previously
selected objects instead, and a press that expands to a group would move nothing
at all. See `docs/editor-groups.md` §3.

**History is snapshotted once, here at drag start** — not per frame. See
`docs/editor-state-and-history.md` §2.

The interaction between the two halves of a press (`selectionHandledOnDown`,
`additiveSelect`) is the press race, and `docs/editor-selection.md` §2 owns that
explanation. The short version: `additiveSelect` is recorded at pointer-down and
read at tap-up so the two halves cannot disagree.

**A handle grab sets `selectionHandledOnDown` too**, even though the selection did
not change. The press is fully handled there, and a tap that did not move is still
a tap on the handle: left unset, the trailing tap would fall through to the canvas
hit-test, which reads a point _outside_ the box — often far outside every member,
for a collection's frame edge — and clear the whole selection.

Note the `enabled === false` branch also **resets `selectionHandledOnDown` to
`false`**. Only the trailing tap consumes that flag and a tap is not guaranteed to
follow (a real drag swallows it); left set, it would swallow the next tap in a
tool where the canvas is selectable but not draggable.

`beginDrag` also calls `cancelRotationSettle()` first — a new grab always beats an
in-flight settle.

## 3. Handle hit-testing

`hitHandle(obj, p)` maps the point into the object's local frame and tests against
the same geometry the overlay draws (`resizeHandles`, `rotateHandle`).

Radii are divided by the object's scale (`HANDLE_HIT_PAD / objectScale`) so the
touch target stays a **constant size on screen** next to the drawn handles,
regardless of object size — the same conversion that places them. See
`docs/editor-coordinates.md` §6.

| Constant         | Value                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| `HANDLE_HIT_PAD` | `18 / Math.SQRT2` (≈ 12.73)                                                 |
| `ROTATE_HIT_PAD` | `HANDLE_HIT_PAD + 8` — the grip is a lone handle, so it gets a wider target |

**The closest target wins.** The rotate grip is considered first with its distance
recorded, and a resize handle only displaces it if strictly closer — so the grip
can never shadow a resize handle.

**A whole selection is tested the same way, against its frame.** `hitFrameHandle`
runs the same `pickHandle` over `selectionFrame(selectedIds, sizedObjects)` — the
frame the overlay draws and the chip is anchored to — so there is one handle
geometry and one box, not three. The frame carries no scale of its own (its
half-extents are already visual), which is why its radii are not divided by
anything: the chrome and the touch target are both in design units. See
[`editor-collections.md`](editor-collections.md) §3.

## 4. Dragging

`updateDrag` bails when disabled, then:

1. **A handle drag owns the object** — if `gs.resizeTargetId` is set, delegate to
   `updateResize` and return. A collection drag has no object id, so it is marked
   by `gs.collectionOrigins` instead, and `updateResize` dispatches on that.
2. **A pinch/rotate owns the object** — if `gs.transformTargetId` is set, return.
   The pan must not also move it, or a relative writer and an absolute writer
   would fight over the same transform.
3. Translate by `translationX / viewport.scale` (view px → design units).
4. Write **once** for the whole selection via `updateObjects`, each object moving
   by the same delta from **its own captured origin** — so a group drag preserves
   relative layout. N objects cost **one render per frame instead of N**.

## 5. Resizing and rotating

`updateResize` works from the **gesture's start state** (`gs.resizeOrigin*`), so a
resize is absolute and accumulates no rounding drift. Rotation is the deliberate
exception — it accumulates wrapped steps so it can travel past 180°.

### Collection handles

When the press lands on a whole selection's frame, the same start-state bundle
holds the _frame_ (centre, rotation, and a box with no scale of its own) and
`gs.collectionOrigins` holds every member's transform as captured at pointer-down.
`updateCollectionResize` then writes all of them at once through `updateObjects`:

| Handle        | Write                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Corner / edge | `scaleCollection` about the **opposite edge**, which is the design-space position of the anchor `anchorFor` names |
| Rotate grip   | `rotateCollection` about the frame **centre**, adding the delta to the running `gs.collectionDelta`               |

The rotation snaps on the **frame's** angle (so a collection lands on the same 45°
multiples an object does) and settles through `settleCollectionRotation`, the same
critically damped spring running on the collection's delta instead of one object's
rotation. Pinch and two-finger rotate stay inert for any multi-selection: a
collection has no pivot two fingers could agree on.

Pointer travel is measured in the object's local frame:

```
p = { x: resizeStartX + translationX / viewport.scale, y: … }
```

### Rotation grip

- `pointerAngle(p, origin.x, origin.y)` gives the pointer's angle about the centre.
- `angleStep(from, to)` returns the shortest signed step in `(-180, 180]`.
  Accumulating **consecutive** steps (not the delta from the origin) is what lets a
  rotation drag pass 180° continuously instead of snapping the object to its
  mirrored angle.
- Angular velocity is a **0.7/0.3 EMA** of `step / dt`, clamped to
  `±MAX_RELEASE_VEL` (720 °/s). This is the release handoff for §6.
- **Snapping is magnet feedback only.** The rotation itself stays 1:1 with the
  pointer; `snapRotationTarget` only decides whether to fire a haptic tick, and
  `lastSnapAngle` ensures it fires **once per snap-window entry, not per frame**.
  The settle on release is what actually lands it on the multiple.

`SNAP_INCREMENT_DEG = 45` with a `SNAP_WINDOW_DEG = 4` window. Multiples are evenly
spaced, so plain arithmetic finds the nearest without any wrap handling.

### Text `e`/`w` handles change the wrap width

On a **text** object, the horizontal handles re-flow the glyphs and leave the font
size alone — narrowing can push a line onto two, widening can pull it back to one.
This is the `wrapWidth` path from `docs/editor-text-engine.md` §3.

- `wrapWidth` is clamped to `[MIN_WRAP_WIDTH, MAX_WRAP_WIDTH]` = `[24, 20000]`.
- The opposite edge is pinned via `localOffset(origin, -dir * hw + (dir * wrapWidth) / 2, 0)`.

### Other handles scale

Everything else scales uniformly, clamped to `[MIN_SCALE, MAX_SCALE]` = `[0.05, 20]`.

`resizeFactor(handle, dx, dy, hw, hh)` turns pointer travel into a size multiplier:

- **Corners** project the drag onto their own diagonal —
  `1 + (dx·ax + dy·ay) / (ax² + ay²)` with `ax = 2·sx·hw`, `ay = 2·sy·hh` — so a
  corner drag is proportional.
- **Edge handles** read a single axis: `1 + (delta · dir) / (2 · half)`.

`anchorFor(handle, hw, hh)` gives the local point that must stay pinned (the
opposite corner, or the opposite edge), and `centerForAnchor(origin, anchor,
scale)` returns the object centre that keeps it fixed in design space:

```
before = localOffset(origin, anchor)              // at the original scale
after  = localOffset({ ...origin, scale }, anchor) // at the new scale
centre = origin + before - after
```

That is what makes a corner drag hold the opposite corner still rather than
scaling about the centre.

### Pinch and rotate (two fingers)

- **Single selection only.** A pivot about one object's centre is unambiguous;
  with a group selected there is no such pivot, so pinch and rotate stay inert.
- `beginTransform` guards twice: it returns if `gs.resizeTargetId` (a handle drag
  owns the object), and returns if `gs.transformTargetId` is already set —
  **pinch and rotate both fire `onStart` for the same two-finger touch**, and the
  second call must not re-snapshot, which would double the history entry.
- It snapshots once per transform interaction, then applies absolute values from
  the captured origins: `applyPinch` clamps to `[0.05, 20]`,
  `applyRotation` sets `rotationOrigin + radians × 180/π`.

## 6. Release: the rotation settle

`endDrag` only does work for a rotation grip. Everything else is already at rest.
If the released rotation sits inside a snap window and is not already on the
multiple, `settleRotation(id, target, v0, reduceMotion)` animates onto it.

The motion is **critically damped (ζ = 1)** — the `springs.ui` preset from
DESIGN.md §6 — so it glides onto the target with no overshoot:

| Constant           | Value      | Role                         |
| ------------------ | ---------- | ---------------------------- |
| `SETTLE_STIFFNESS` | `260`      | Spring stiffness             |
| `SETTLE_C`         | `2 · √260` | Critical damping coefficient |
| `SETTLE_MAX_MS`    | `400`      | Hard cap                     |
| `SETTLE_EPS_ANGLE` | `0.05`     | Angular rest threshold       |
| `SETTLE_EPS_VEL`   | `5`        | Velocity rest threshold      |

With `A = from − target` and `B = v0 + C·A`:

```
θ(t) = target + (A + B·t)·e^(−C·t)
ω(t) = (B − C·(A + B·t))·e^(−C·t)
```

Seeded with the pointer's release angular velocity `v0` — the **velocity handoff**
DESIGN.md §6 asks for, which a duration tween cannot express.

Behaviour worth preserving:

- **Reduced motion jumps straight to the target** (one write, no animation).
- It runs on `requestAnimationFrame` and writes through `updateObject`, so it is
  **release-time only** — tracking during the drag is untouched, and no snapshot is
  taken (history was already snapshotted at grab start).
- The loop re-reads the object from the store each frame and **bails if it has
  disappeared** (deleted mid-settle).
- A **module-level `cancelSettle`** is set while animating and cleared on
  completion. `cancelRotationSettle()` is called at the top of both `beginDrag`
  and `beginTransform`, so **a new grab always wins over an in-flight settle** and
  the next drag starts from the live on-screen rotation.

## 7. Teardown

`clearResize` runs on every `onFinalize` (pan, pinch and rotate alike) and resets
`resizeTargetId`, `resizeHandle`, `transformTargetId`, `lastSnapAngle` and
`dragOrigins`. Because it runs on _finalize_, it still fires when a gesture is
cancelled rather than completed — a cancelled drag cannot leave stale scratch
state behind.

## 8. Code map

| Concern                                                             | File                                |
| ------------------------------------------------------------------- | ----------------------------------- |
| Composition, `useObjectGestures`, `tapRelay`                        | `src/editor/use-object-gestures.ts` |
| `beginDrag` decision table, `updateDrag`                            | `src/editor/use-object-gestures.ts` |
| `updateResize`, `resizeFactor`, `anchorFor`, `centerForAnchor`      | `src/editor/use-object-gestures.ts` |
| `hitHandle`, `HANDLE_HIT_PAD`, `ROTATE_HIT_PAD`                     | `src/editor/use-object-gestures.ts` |
| `settleRotation`, `cancelSettle`, `angleStep`, `snapRotationTarget` | `src/editor/use-object-gestures.ts` |
| `beginTransform`, `applyPinch`, `applyRotation`, `clearResize`      | `src/editor/use-object-gestures.ts` |
| `toDesign` (viewport → design)                                      | `src/editor/use-object-gestures.ts` |
| `toLocalPoint`, `resizeHandles`, `rotateHandle`, `OBJECT_HIT_PAD`   | `src/editor/hit-test.ts`            |
| Gesture scratch fields the handlers read and write                  | `src/editor/store.ts`               |
| Shift/Cmd/Ctrl tracking (web)                                       | `src/editor/modifier-keys.web.ts`   |
| Tap relay destination, hit-test effect                              | `src/editor/EditorCanvas.tsx`       |
| The press race, multi-select, background flow                       | `docs/editor-selection.md`          |
