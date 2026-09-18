# Editor Collections

> How several objects become one element — and how a split word became the same
> thing. The membership field, the two states, the box the handles are drawn on,
> and the bar that walks a collection's members. This is the behavior contract;
> when code and this document disagree, fix the code.

---

## 1. One concept, two kinds

A **collection** is a set of objects the editor treats as one element: tapping any
member selects them all, and they move, nudge, duplicate, restack, restyle, scale
and rotate together.

There are two ways to get one, and they differ only in what they remember:

| Kind         | Membership | Provenance                                       |
| ------------ | ---------- | ------------------------------------------------ |
| A group      | `groupId`  | none — unordered                                 |
| A split word | `groupId`  | `part` (`rootId`, `index`, `count`, `gapBefore`) |

`splitObjectIntoParts` stamps a `groupId` on the parts, so **a split word is a
collection**. Its `part` ref is what rejoin needs to rebuild the text and what
gives the members their reading order; membership is what makes them one element.
Before this, the two features had separate machinery (a parts strip keyed on
`part.rootId`, a group keyed on `groupId`) and the two disagreed: a _grouped_ word
could not be edited letter by letter, because selecting a part grew back to the
whole group.

`rejoin` is deliberately still keyed on `part.rootId`, **not** on membership, so
ungrouping a word does not destroy the ability to rejoin it. The screen therefore
derives two things: `rejoinParts` (provenance) and `members` (membership).

## 2. The two states

| State       | `selectedIds`      | Chrome                                                                       |
| ----------- | ------------------ | ---------------------------------------------------------------------------- |
| **Whole**   | every member       | one frame with eight handles and a rotate grip                               |
| **Entered** | exactly one member | that member's own single-object chrome; the frame is drawn dashed as context |

The invariant in `groups.ts` therefore reads: **a selection is a union of whole
collections — except that at most one collection may be _entered_, in which case
exactly one of its members is selected.** The whole-collection half is what lets
the drag, nudge, delete, duplicate and align paths treat a collection as one
element without knowing collections exist; the entered half is what lets a split
word still be edited letter by letter.

**Entered is derived, never stored**: `selectedIds.length === 1` and that object
carries a `groupId`. `expandToGroups` grows any selection that touches a
collection, so a single selected member can only have got there through an
explicit enter — which means undo, redo and `loadProject` need no extra state at
all.

### Entering and leaving

| Gesture / control                                             | Effect                                                |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| Tap a member of an **unselected** collection                  | Selects the whole collection                          |
| Tap a member that is **already selected** (a tap, not a drag) | Enters it — the second-tap idiom                      |
| Tap a tile in the member track                                | Enters that member                                    |
| Tap empty space, or Escape                                    | Clears the selection entirely                         |
| Tap the bar's head while entered                              | `exitCollection` — selects the whole collection again |

The enter happens at **tap-up**, never at pointer-down: a drag has to keep moving
the whole collection, and only a real tap (which a drag swallows) can mean "step
inside". `enterMember` is a store action rather than a plain `select` because
`select` on a member _of the entered collection_ keeps you inside — that is what
makes stepping between letters work — so the two intents need two entry points.

## 3. The frame

A collection has no transform of its own — the document stays flat, with no group
node — so its box is **derived** from its members every time it is needed:

```
members' boxes, measured in the collection's frame, unioned, then oriented
```

- **Orientation is derived too**: when every member carries the same rotation, the
  arrangement's own axes are that rotation and the box is exact. That covers the
  common cases — a word plus ornaments at 0°, and any collection after a
  collection rotate, since that adds one delta to every member. When the members
  disagree there is no honest orientation to draw, so the box falls back to the
  axis-aligned union of the rotation-widened boxes (what `groupAabb` measures) and
  its rotation reads 0. The cost of not storing a frame; the alternative is a
  document-level side table.
- **Half-extents are visual** (member scales folded in), so the frame carries no
  scale of its own. That is why the shared chrome geometry runs with
  `objectScale = 1` and every length divides by the **view scale alone** — unlike
  `SelectionOverlay`, which lives inside one object's transform and has to divide
  that object's scale out as well.
- **One rule, three consumers**: `selectionFrame(ids, sized)` in `groups.ts`
  returns the frame, whether it is `whole` or `entered`, and its members. The
  canvas draws it, the bar labels it and the gesture layer grabs it — so the box
  the user sees, the box the bar points at and the box a press can grab are the
  same box by construction.

## 4. What the handles do

A handle drag on a whole selection is the same shape as one on an object: values
are recomputed **absolutely** from the origins captured at pointer-down, so
nothing accumulates, and every member is written at once through `updateObjects`
(one store write, one render per frame for the whole collection).

| Handle                                 | Maths                                                                                                                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corner / edge                          | Scale the collection about the **opposite edge** (`scaleCollection`): every offset from that pivot is multiplied by the factor _and_ every member's own scale follows it, so the arrangement stays similar instead of each member growing in place |
| Rotate grip                            | `rotateCollection`: each member **orbits the frame centre** _and_ turns by the same delta. Turning them in place would leave the arrangement unchanged                                                                                             |
| Rail `scaleUp`/`scaleDown`             | The same scale about the frame centre                                                                                                                                                                                                              |
| Rail / keyboard `rotateCcw`/`rotateCw` | The same rotation about the frame centre                                                                                                                                                                                                           |
| Rail `flipH`/`flipV`                   | `flipCollection`: offsets mirror about the frame centre **and** each member's angle negates with its flip toggled — a mirror is a rotation _and_ a flip                                                                                            |

The rotation snaps to the 45° multiples like an object's does — the _frame's_
angle is what snaps — and settles onto the target with the same critically damped
spring (`settleCollectionRotation`, animating the collection's rotation _delta_
about the captured pivot).

**The scale clamp is a collection-level decision.** `scaleCollection` clamps its
_factor_ so that no member leaves `OBJECT_SCALE_BOUNDS`, rather than clamping each
member on its own: one factor keeps the arrangement similar, while per-member
clamping would move the offsets by one factor and the boxes by another and the
composition would come apart. When the members' scales span a wider range than the
bounds allow there is no such factor, so the clamp falls back to per-member and the
similarity degrades — the honest outcome for a document that arrived that way.

## 5. The collection bar

The element count used to be a 12px text badge at the **head of the selection
rail**. It was charged against the rail's button budget — twice over, since it also
shrank the context strip's share — its measured width was never reset when it
unmounted, and it was the only rail style that ignored the theme.

It became a chip on the canvas, anchored to the frame's top edge. It is now
`CollectionBar`: that same head, with the member track (§6) beside it inside one
anchored surface. The head says:

| Selection               | Head                        |
| ----------------------- | --------------------------- |
| A whole collection      | `مجموعة · 3` / `Group · 3`  |
| A loose multi-selection | `المحدد: 3` / `Selected: 3` |
| Inside a collection     | `2/3`, with a back chevron  |

**Why the track left the rail.** The rail holds the selection's _actions_, and the
track is navigation — but the two were sharing one 56dp row and one width budget.
With a three-part word selected the step arrows alone spent 84 of the ~146dp the
context zone was allowed, so the rail truncated to three actions while the tiles
scrolled one-and-a-half deep. Both halves lost, and the loss was worst for exactly
the selection that needs the most navigation. On the canvas the bar has the whole
card's width, and the rail keeps its budget for actions
([`editor-selection-bar.md`](editor-selection-bar.md) §6).

**Placement** is `collectionBarPlacement` in `groups.ts` — pure, so
`check-groups.mjs` covers it. Above the frame's top edge by preference; below
`frameBottomCentre` when the frame sits too close to the top of the canvas; and
clamped inside the card only when the selection leaves room for neither. The chip
this replaced only ever clamped, which is fine for a one-line label and not fine
for a row of tiles: a clamped bar sits _over_ the very members it offers to
navigate.

It is a plain React Native view in the canvas wrapper — the same place
`LearnOverlay` lives, and outside the gesture detector — so it cannot resize the
canvas (which would re-run fit-to-view and visibly zoom the design) and it can be a
real, accessible control. Its layer is `box-none`, so the canvas keeps every touch
that is not on the bar. It follows pan and zoom because it is positioned from the
frame through the published `Viewport` (which now carries the canvas box size for
exactly this reason), and its layer is **inset by the wrapper's own padding** so
that "inset 4 from the canvas edge" means the card's edge — the chip measured
against a box a whole padding-step larger, so its `left: 4` was 8dp _outside_ the
card it was labelling.

## 6. The member track

The parts strip generalised: a tile per **member** of the selected collection, in
reading order (`part.index` when every member is a part, document order otherwise).

- A text member renders its own glyph in its own font — a faithful preview, which
  is what makes a split word navigable letter by letter. Anything else shows its
  kind's glyph, and its index caption is then the only thing telling two tiles
  apart, so it is not decoration.
- Tapping a tile **enters** that member; the prev/next arrows step through them
  with wraparound. Both are bound in learn mode (`help.press`), so while it is on
  they explain themselves instead of moving the focus.
- A hairline separates the head from the track. Without it the head's `2/3` and the
  tiles read as one run of chips — which is the confusion the bar exists to undo.
- The track appears only when there is more than one member. A loose
  multi-selection has no members at all (`collectionMembers` returns none for it),
  so the bar is a bare head reading `Selected: 3`.
- The track is the **only** part of the bar that scrolls, and only when the tiles
  genuinely outgrow the card; the head and both arrows stay put.

## 7. What a collection does not do

- **No stored frame.** Orientation is derived (see §3). A persisted per-collection
  frame is the upgrade path if mixed-rotation collections ever need a tight box.
- **No pinch or two-finger rotate.** They still require a single object: a
  collection has no pivot the two-finger gesture could agree on. The handles and
  the rail buttons are the routes.
- **Pressing inside the box but on empty space clears the selection**, exactly as
  a multi-selection always did. Dragging a collection means dragging a member.
- **No nesting.** `canGroup` refuses a selection that already contains a grouped
  object.
- **No marquee.** `hitTest` still resolves a point to one object id; membership is
  applied afterwards, in `select`.

## 8. Lifecycle

| Mutation               | Membership behaviour                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `removeObjects`        | Dissolves a collection left with fewer than two members                                     |
| `splitObjectIntoParts` | The parts inherit the source's `groupId`, or get a fresh one — a grouped word stays grouped |
| `mergeObjectParts`     | The merged object inherits the membership its parts shared                                  |
| `duplicateObjects`     | Clones that were members get a **fresh** shared `groupId`, so a copy is its own collection  |
| `undo` / `redo`        | `restorableSelection` filters, then re-expands to whole collections                         |

`dissolveSingletonGroups` runs inside the same `set()` as the mutation that shrank
the collection, so one undo restores both the objects and their membership. History
needs nothing else: `groupId` is a flat field, so a snapshot carries it.

## 9. Code map

| Concern                                                                   | File                                |
| ------------------------------------------------------------------------- | ----------------------------------- |
| Membership field (`GroupMember`)                                          | `src/storage/project-schema.ts`     |
| Expansion, the entered state, the frame, the transform maths              | `src/editor/groups.ts`              |
| `select` / `enterMember` / `exitCollection`, the invariant at every write | `src/editor/store.ts`               |
| The collection overlay (frame, handles, grip)                             | `src/editor/EditorCanvas.tsx`       |
| Frame handle hit-testing, the collection resize and its settle            | `src/editor/use-object-gestures.ts` |
| The collection bar — head, member track, placement                        | `src/editor/collection-bar.tsx`     |
| The bar's head copy, the collection-aware rail actions                    | `src/editor/EditorScreen.tsx`       |
| Availability (`canGroup`/`canUngroup`), the rail's slot table             | `src/editor/selection-actions.tsx`  |
| Help entries, the canvas-group legend entries                             | `src/editor/help/catalog.ts`        |
| Executable spec for all of the above that is pure                         | `scripts/check-groups.mjs`          |

## 10. Related documents

| Document                                                         | Relationship                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`editor-groups.md`](editor-groups.md)                           | The membership field and the invariant, stated for the group case                    |
| [`editor-split-and-rejoin.md`](editor-split-and-rejoin.md)       | The split/rejoin algorithm, and why a part set is a collection with provenance       |
| [`editor-gestures.md`](editor-gestures.md)                       | §2 owns the pointer-down decision table that now resolves a collection frame as well |
| [`editor-coordinates.md`](editor-coordinates.md)                 | The four frames, and which chrome divides by which scale                             |
| [`editor-selection-bar.md`](editor-selection-bar.md)             | §6 owns the width budget the count badge and the member track were removed from      |
| [`editor-help-and-learn-mode.md`](editor-help-and-learn-mode.md) | How the collection gestures reach learn mode's canvas legend                         |
