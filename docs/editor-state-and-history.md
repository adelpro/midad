# Editor State & History

> How the midad editor holds its working design, its selection, and its undo
> stack. This is the behavior contract; when code and this document disagree,
> fix the code.

---

## 1. The state slices

`useEditorStore` (`src/editor/store.ts`) is one zustand store holding eight
slices. Nothing here is persisted — the document is written to disk by
`useAutoSave`, not by the store.

| Slice             | Type                   | What it is                                                                                                    |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `project`         | `MidadProject \| null` | The working document: canvas, objects, grid flag, name                                                        |
| `selectedIds`     | `string[]`             | Current selection, in the order the user added to it — always a union of whole groups (`editor-groups.md` §3) |
| `multiSelectMode` | `boolean`              | When on, taps add/remove instead of replacing                                                                 |
| `sizedObjects`    | `SizedObject[]`        | Measured boxes + transforms, published **by the canvas**                                                      |
| `viewport`        | `Viewport`             | Fit-to-view scale + centering offsets (view px)                                                               |
| `gs`              | `GestureScratch`       | Non-reactive gesture bookkeeping — see §7                                                                     |
| `past`            | `HistoryEntry[]`       | Undo stack, capped at `MAX_HISTORY` (`50`)                                                                    |
| `future`          | `HistoryEntry[]`       | Redo stack, capped at `MAX_HISTORY`                                                                           |

`Viewport`, `DragOrigin`, `GestureScratch` and `HistoryEntry` are all
module-private except `DragOrigin`, which the gesture layer names.

## 2. Two classes of mutator

This is the rule that matters most, and it is not uniform. Mutators split in two:

**Self-snapshotting.** These call `get().snapshot()` themselves, before writing:
`addObject` · `removeObjects` · `duplicateObjects` · `splitObjectIntoParts` ·
`mergeObjectParts` · `bringToFront` · `sendToBack` · `groupSelected` ·
`ungroupSelected` · `alignSelected` · `nudgeSelected` (conditionally — see §6).

**Not snapshotting.** These write straight to `project` and record nothing:
`updateObject` · `updateObjects` · `setCanvas` · `setGrid`.

`updateObject`/`updateObjects` are the hot path — every drag frame, every colour
swatch, every style patch. Making them snapshot would either flood the history or
force them to dedupe at 60 Hz, so **the caller decides**. The gesture layer and
`EditorScreen` call `store.snapshot()` once at the start of a gesture or
immediately before a discrete edit, then mutate freely:

```ts
const store = useEditorStore.getState();
store.snapshot();
updateObject(selectedObject.id, { color: col });
```

The practical consequence: **a new `updateObject`/`updateObjects` call site must
snapshot for itself**, or that edit silently becomes non-undoable. If you are
adding an edit that should not be undoable, say so in a comment.

## 3. `snapshot()` records the state _before_ the mutation

It is called first, so the entry it pushes is the pre-mutation document. It
compares only `objects` — via `JSON.stringify` against the newest entry — and
bails with an empty patch when they match. Comparing objects alone is what makes
that safe: an identical entry already _is_ the pre-mutation state, so skipping it
costs the undo nothing. Selection is deliberately excluded from the comparison,
so a pure selection change does not look like a duplicate.

`clone(objects)` shallow-copies each object and **one level of `transform`**.
That is sufficient because no mutator ever writes into a nested field in place —
every patch spreads a new object. Add in-place mutation of a nested field and
this stops being true.

## 4. A history entry carries its selection

`HistoryEntry` is `{ objects, selectedIds }` — the selection belongs to the step.
A history that only remembered objects strands the user at both ends: undoing a
delete would restore objects with nothing selected, and undoing an insert would
leave `selectedIds` pointing at an id the restored document does not contain.

`restorableSelection(entry)` filters the entry's selection down to ids its own
objects still hold. Both `undo` and `redo` run the restored selection through it;
neither reads `selectedIds` back raw.

`undo` moves the current objects onto `future` and the popped entry onto
`project`; `redo` is the mirror image. Both push onto the opposite stack with the
same `.slice(-MAX_HISTORY)` cap. Any `snapshot()` clears `future` — the standard
"a new edit discards the redo branch" rule.

## 5. Z-order: `zIndex` paints, array order breaks the tie

Objects are painted by a stable sort on `zIndex`
(`[...objects].sort((a, b) => a.zIndex - b.zIndex)`), so objects sharing a
`zIndex` keep their **array order**. Two consequences:

- `splitObjectIntoParts` gives every part the source's slot _and_ its `zIndex`,
  so a split word still paints in reading order without needing distinct z-index
  values.
- `bringToFront` / `sendToBack` assign a single new value to the whole selection
  (`maxZ + 10` / `minZ - 10`), so a multi-object front/back does not invent an
  ordering among the selected objects — it preserves the existing one.

`duplicateObjects` is the exception: clones are staggered (`maxZ + 10 + i * 10`)
so a duplicated group keeps its internal layering, offset by a 24-unit diagonal,
and each clone is explicitly given `part: undefined` — a duplicate must not claim
membership of the source's split group, or the group would gain a second part
with the same index and could never be re-joined.

## 6. Held-key nudging coalesces into one entry

A held arrow key auto-repeats at roughly 30 presses/second. `nudgeSelected`
therefore folds a burst into one history entry, using two scratch fields:

- `gs.nudgeBurstAt` — the previous press's timestamp. A press within
  `NUDGE_COALESCE_MS` (`400`) continues the burst.
- `gs.nudgeBurstAnchor` — the newest `past` entry's `objects` array, compared by
  **identity**, not equality. `snapshot()` stores the array it pushed, so a
  different reference means something else was recorded in between and the burst
  must not swallow it.

So a burst shares one snapshot until either 400 ms of silence passes or any other
action touches the history. `nudgeSelected` also returns early on a zero delta or
an empty selection, so a no-op nudge never opens a history entry.

## 7. `gs` — gesture scratch lives in the store but not in the UI

`GestureScratch` holds drag origins, the resize/rotation origin bundle, release
velocity, the 45° snap window (`lastSnapAngle`), and the press-resolution flags
`selectionHandledOnDown` / `additiveSelect`. Nothing subscribes to `gs`, so
writing it never renders. It lives in the store rather than refs so gesture
handlers stay React-Compiler-safe.

Fields group roughly as: **drag** (`dragOrigins`) · **press meaning**
(`selectionHandledOnDown`, `additiveSelect`) · **transform** (`transformTargetId`,
`scaleOrigin`, `rotationOrigin`) · **resize** (`resize*`, ~14 fields) ·
**rotation release** (`rotateVelocity`, `resizeLastAngle*`) · **nudge burst**
(`nudgeBurst*`). `loadProject` resets it to `EMPTY_SCRATCH`.

`selectionHandledOnDown` and `additiveSelect` are the two halves of the press
race — see `docs/editor-selection.md` §2, which owns that explanation.

## 8. `sizedObjects` is a one-way channel

`EditorCanvas` measures every object every render and pushes the result into the
store via `setSizedObjects`. Gestures and `alignSelected` then read it instead of
touching the render tree — that is the whole point: hit-testing and alignment
need measured boxes, and neither may depend on React rendering.

The store is not a dumb sink. `setSizedObjects` compares each entry's `id`,
`transform` **identity** and `box.width`/`box.height`, and returns the previous
state unchanged when all of them match. Because `box` is a fresh object every
render, identity comparison on it would never match — hence the field-wise check.

`updateObjects` is the other bail-out with real consequences: it returns the
previous state when no patch matched an object, so a drag frame that misses
every target costs zero renders.

## 9. No-op writes are suppressed

Several setters return the previous state (or skip `set` entirely) to avoid
notifying subscribers:

| Setter                                                                                                                                                             | Suppressed when                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `select(null)`                                                                                                                                                     | selection is already empty                                                                                       |
| `select(id)`                                                                                                                                                       | the same single id is already selected                                                                           |
| `enterMember(id)` / `exitCollection()`                                                                                                                             | already entered on that member / not entered at all                                                              |
| `setSizedObjects`                                                                                                                                                  | ids, transform identities and box sizes all match                                                                |
| `setViewport`                                                                                                                                                      | scale and both offsets are unchanged                                                                             |
| `updateObjects`                                                                                                                                                    | no patch matched any object                                                                                      |
| `snapshot`                                                                                                                                                         | the newest entry's objects stringify identically                                                                 |
| `alignSelected`, `nudgeSelected`, `duplicateObjects`, `splitObjectIntoParts`, `mergeObjectParts`, `bringToFront`, `sendToBack`, `groupSelected`, `ungroupSelected` | guard clauses: empty selection, unknown id, empty id list, and for the two group actions `canGroup`/`canUngroup` |

`select(id)` in additive mode **toggles**: an already-selected id is removed. That
is intentional and shared with the canvas tap path.

## 10. Outside the history by design

`setCanvas` and `setGrid` never snapshot, and no caller wraps them in one. So
these are document writes that are **not undoable**:

- paper colour and background image (`setBgColor`, `setBgImage`, `clearBgImage`)
- the grid toggle (`toggleGrid`)
- the project name (`setProjectName`)

They are still saved — they live in `project` and auto-save persists the whole
document. The project name is the exception: the rename sheet's Save calls
`saveProject` directly, so the commit does not depend on auto-save being on. If
undoable backgrounds are wanted, that is a new decision, not something the
current code implies.

Separately, `selectAll` sets `multiSelectMode: true`. Select-all _is_ a
multi-selection, so leaving the mode off would show the count badge and the align
actions while the next tap replaced the whole selection.

## 11. Code map

| Concern                                              | File                                             |
| ---------------------------------------------------- | ------------------------------------------------ |
| Store, history, all document mutations, `gs`         | `src/editor/store.ts`                            |
| Group membership + the whole-groups invariant        | `src/editor/groups.ts`                           |
| `HistoryEntry`, `MAX_HISTORY`, `restorableSelection` | `src/editor/store.ts`                            |
| Nudge coalescing, `NUDGE_COALESCE_MS`                | `src/editor/store.ts`, `src/editor/shortcuts.ts` |
| Publishing `sizedObjects` + `viewport`               | `src/editor/EditorCanvas.tsx`                    |
| Gesture-start snapshots                              | `src/editor/use-object-gestures.ts`              |
| Discrete-edit snapshots, colour/style edits          | `src/editor/EditorScreen.tsx`                    |
| Background + grid writes (no snapshot)               | `src/editor/EditorScreen.tsx`                    |
| Selection semantics, the press race                  | `docs/editor-selection.md`                       |
