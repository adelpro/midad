# Editor Selection Bar

> The rail above the tool rail: which actions render, in what order, how many
> fit, and how the user reorders them. This is the behavior contract; when code
> and this document disagree, fix the code.

---

## 1. Why this module exists

Three constraints shape the whole design:

- **One row can never hold them all.** A selection owns up to twenty-three
  controls; a phone rail is far narrower. Letting the row scroll would park the
  trailing controls off-screen — and **in Arabic that is the _left_ edge**, where
  nothing signals they exist. So the rail renders the highest-priority actions
  that fit, and the remainder live in a sheet behind a permanent `⋯` that is
  always reachable.
- **The order is the user's to keep.** The rail truncates from its tail, so the
  only way to protect an action from being cut is to put it at the front (§6).
- **Copy lives in one place.** The help catalog already holds a label, role, icon
  and shortcut for every one of these actions, so this table names only **ids**:
  `sel.<id>` is the help key (§7).

`selection-actions.tsx` reads no editor store. The screen supplies the behaviour,
so "what the selection is" → "what is available" stays a pure function.

## 2. The action table

`RAIL_SLOTS` — one entry per slot, in priority **and** truncation order:

| #   | Slot               | Notes                                                         |
| --- | ------------------ | ------------------------------------------------------------- |
| 0   | `styleOpen`        | Leads on purpose — see below                                  |
| 1   | `scaleUp`          |                                                               |
| 2   | `scaleDown`        |                                                               |
| 3   | `fitText`          | Text only                                                     |
| 4   | `split`, `rejoin`  | **Share a slot** — only one can apply to a given selection    |
| 5   | `group`, `ungroup` | **Share a slot** — a selection is loose elements or one group |
| 6   | `duplicate`        |                                                               |
| 7   | `bringToFront`     |                                                               |
| 8   | `sendToBack`       |                                                               |
| 9   | `delete`           |                                                               |

`styleOpen` leads because it is the **only route to the style panel**, so it has
to survive every truncation. It costs one slot rather than the five a full preset
navigator (arrows + name) used to take from the same row.

The two shared slots are the same idea twice. `split`/`rejoin` are one decision
seen from two sides; `group`/`ungroup` are the two ends of another — a selection
is either a set of loose elements (which can be grouped) or one whole group
(which can be dissolved), never both. See `editor-groups.md` §7.

`OVERFLOW_ACTIONS` — sheet-only, 13 ids: `rotateCcw`, `rotateCw`, `flipH`, the
six `align*`, `centerH`, `centerV`, `stylePrev`, `styleNext`.

The reasons differ per group, and they are worth keeping in mind before promoting
anything into the rail:

- **Rotation and flip** are already gestures on the canvas (the grip above the
  selection, a two-finger twist), so a rail button duplicates them.
- **Scale** deliberately stays in the rail instead, because pinch-to-zoom is the
  **least discoverable** of the gestures.
- **The align group** only applies to a multi-selection.
- **The preset arrows** are a second route to what the style panel already lists,
  and at two slots they cost more width than the panel's own button. Stepping
  through presets is now a two-tap errand; picking one from the panel is still one.

`SHEET_ORDER` = `RAIL_SLOTS.flat()` ++ `OVERFLOW_ACTIONS` — the rail's priorities
first, so an action the bar just dropped is near the top of the sheet where it can
be picked straight back up. The two tables are **disjoint by construction**, which
is what lets this be a plain concatenation.

`SLOT_INDEX_OF` maps each id to its slot index. It is a lookup rather than a
re-walk of the table because the rail is built from a **flat order of ids**, and
the one-per-slot rule has to survive that flattening — otherwise `split` and
`rejoin` could each claim a button for a selection that can do either.

## 3. Availability

Only these facts about the selection decide which actions exist:

| `SelectionShape` | Meaning                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `isText`         | A text object is selected                                        |
| `canSplit`       | The text can be broken into parts                                |
| `canRejoin`      | The selection is one part of an already-split word               |
| `isMulti`        | More than one **element** is selected                            |
| `canGroup`       | Two or more loose elements are selected, none already in a group |
| `canUngroup`     | The selection is exactly one whole group                         |

`isMulti` counts **elements**, not objects: a group is one element, so a group of
three offers the actions a single object does. That is what "acts as a unique
element" means for this table. The two group predicates come straight from
`groups.ts`, so the button and the behaviour cannot disagree
(`editor-groups.md` §7).

`isAvailable(id, shape)` maps them:

| Ids                                                                                  | Available when |
| ------------------------------------------------------------------------------------ | -------------- |
| `styleOpen`, `stylePrev`, `styleNext`, `fitText`                                     | `isText`       |
| `split`                                                                              | `canSplit`     |
| `rejoin`                                                                             | `canRejoin`    |
| `group`                                                                              | `canGroup`     |
| `ungroup`                                                                            | `canUngroup`   |
| `alignLeft`, `alignCenterH`, `alignRight`, `alignTop`, `alignMiddleV`, `alignBottom` | `isMulti`      |
| everything else                                                                      | always         |

## 4. `railActionIds` — filtered, never rebuilt

`railActionIds(shape, order)` walks the stored order and applies two filters:

1. **availability** — skip what the selection cannot use
2. **one-per-slot** — the first survivor of a shared slot wins

The order is **filtered, never rebuilt**. That is what stops a pin from being lost
to whatever happens to be selected: `fitText` stays in the order while a shape is
selected (it is simply not rendered) and comes back by itself the moment text is
selected again.

## 5. `overflowActionIds` — "in the bar, or in here"

The rule is that an action is reachable from **exactly one** of the two surfaces.
`overflowActionIds(shape, railIds)` returns everything available in `SHEET_ORDER`
that is not in the ids it is handed.

So an action the user took out of the bar is listed in the sheet — which is also
how it gets back in.

**The caller must pass the rail's _visible_ head**, not all candidates:
`railIds.slice(0, visibleCount)`. Passing the full candidate list would hide the
actions the width budget cut, which is exactly the bug this signature prevents.

## 6. The width budget

`visibleActionCount({ railWidth, contextWidth, countWidth, available })` returns
how many actions fit beside everything else in the row.

Geometry, declared once so the components and the maths cannot disagree:

| Constant                 | Value                       |
| ------------------------ | --------------------------- |
| `RAIL_BUTTON_SIZE`       | `40`                        |
| `RAIL_GAP`               | `spacing.xs` (4)            |
| `RAIL_PADDING`           | `spacing.md` (12), per side |
| `CONTEXT_ZONE_MAX_SHARE` | `0.4`                       |
| `RAIL_MIN_BUTTONS`       | `2`                         |
| `RAIL_MIN_CLUSTER`       | `2 × 40 + 1 × 4` = 84       |

The computation:

```
usable        = railWidth − 2 × RAIL_PADDING
zoneCeiling   = max(0, min(usable × CONTEXT_ZONE_MAX_SHARE,
                           usable − RAIL_MIN_CLUSTER − RAIL_GAP))
zoneCharge    = contextWidth > 0 ? min(contextWidth, zoneCeiling) + RAIL_GAP : 0
room          = usable − zoneCharge
fit           = floor((room − RAIL_BUTTON_SIZE) / (RAIL_BUTTON_SIZE + RAIL_GAP))
```

`fit` falls out of `(visible + 1) × button + visible × gap ≤ room` — the visible
actions **plus `⋯`** have to fit, which is why one button is subtracted up front.

### The count badge left this budget

The multi-selection count used to sit at the head of the row as a `<Text>`, charged
as `countCharge = countWidth + RAIL_GAP` against `usable` — and again inside the
zone's ceiling, so it cost the actions twice over. It is now part of the collection
bar on the canvas (`editor-collections.md` §5), which is both where a label about
the selection belongs and the reason `visibleActionCount` no longer takes a
`countWidth`. The row gained roughly one button.

The move also removed a latent bug: nothing ever reset `countWidth` when the badge
unmounted, so a stale width went on being charged until the badge happened to
re-layout.

### Why the remaining sibling is measured from its _content_

Each sibling is sized to whatever the actions leave over, so **measuring the
laid-out box would be circular**. `contextWidth` comes from
`onContentSizeChange` on the context zone's own scroller — never from a box the
action count influences.

**A width of `0` means the sibling is not rendered, so it is charged nothing —
including no gap.**

### The member track left this budget too

The zone used to hold the collection's **member track** — a tile per member with
prev/next arrows. It is now the collection bar on the canvas
(`editor-collections.md` §5), for the same reason the count badge went: it is not
an action. The cost was worse than the badge's, because the track was the widest
thing the zone ever held and the _longest_ words paid most: on a 390pt phone with a
three-part word selected, the two step arrows alone spent 84 of the ~146dp the zone
was allowed, and `fit` came out at **3**. The same selection now renders **7**
actions, and the tiles no longer have to scroll to be read.

### What is left in the zone

Content about the current _tool_, and nothing else: the ink swatches for the colour
tool, the paper swatches and the image picker for the background tool, and the
transient refusal notice. So the zone is empty in the editor's most common state.

That state used to be charged anyway. The zone's scroller always reports _some_
width — `contextTrack` keeps `paddingHorizontal: spacing.md`, and the
`contentContainerStyle`'s padding counts as content — so an empty zone went on
claiming ~28dp of the row in every state, forever. The screen now gates it:
`contextWidth: hasContext ? contextWidth : 0`, where `hasContext` is exactly the
three cases above. This is the §6 rule ("a width of `0` means the sibling is not
rendered, so it is charged nothing") applied to the last thing that was not
honouring it, and it is worth a button on its own.

### Why the context zone is capped

The zone keeps a scroller, so its content can always ask for more width than the
rail has. Measuring it from that content handed it an unbounded claim against the
actions' budget: **four parts of a split word were enough to claim the entire
row**, so the bar rendered nothing but `⋯` — the member track had _replaced_ the
selection bar instead of sitting beside it.

The zone is therefore charged at most `CONTEXT_ZONE_MAX_SHARE` of the usable
width, and the actions keep the rest. The conflict that produced the rule is now
moot — the track that caused it is on the canvas — but the cap stays: a large
swatch set can still outgrow the width, and a tail that scrolls out of sight is
invisible chrome. Swatches are content, so scrolling them is the honest
degradation (DESIGN.md §5).

`RAIL_MIN_BUTTONS = 2` guarantees the head action and `⋯` always fit. `⋯` is the
only route to every action the budget cut, so it can never be the thing that gets
cut — and it is useless without at least one action to have been cut. Below that
the zone is charged _less_ than its share rather than the bar emptying itself into
the sheet.

**Before measurement** (`railWidth <= 0` or `available <= 0`) the function returns
`available` — assume everything fits and let the next layout pass correct the
row. One frame of spill beats a rail that renders empty first.

## 7. Pinning

A **pin** moves an action to the **head** of the bar — the one position the width
budget can never cut. An unpin drops it out of the bar entirely, and §5 then lists
it in the sheet.

`togglePin(id)`:

```
current.includes(id)
  ? current.filter(x => x !== id)          // unpin
  : [id, ...current.filter(x => x !== id)] // pin → head
```

| Surface   | Control                                                                          |
| --------- | -------------------------------------------------------------------------------- |
| `⋯` sheet | The row's **trailing pin** — the discoverable half                               |
| Rail      | **Long-press a rail button** — `IconButton`'s `onLongPress={action.pin?.toggle}` |

Two consequences worth preserving:

- **Pin state means "membership of the bar's order", not visibility.** An action
  can be pinned and not currently rendered (text-only actions while a shape is
  selected). `resolveSelectionActions` reads it as `bar.includes(id)` against the
  full stored order, not against the rail's filtered ids.
- **Pressing the pin never closes the sheet.** The sheet is the tool that just
  changed, so closing it would hide the reordering in progress. The action's own
  press _does_ close it, via `afterRun`.
- The pin's label is the **other** state's (`sel.pinToBar` / `sel.unpinFromBar`),
  so a press reads as what it _will do_: an action in the bar offers to take
  itself out.
- `⋯` itself has **no pin** — `pinnable = id !== "more"`. It is not an action and
  can never leave the bar, because it is the way everything else gets back in.
- **`IconButton` suppresses its own hint bubble whenever a caller passes
  `onLongPress`** (`ui/icon-button.tsx`) — one gesture, one meaning. So rail
  buttons never open a tooltip; the rail's labels are a learn-mode tap away.

## 8. Persistence

The bar's order is `useSettings.selectionBarActions: SelectionActionId[] | null`
under the `midad:settings` key.

`null` means **never customised**, and the screen resolves it as
`selectionBarActions ?? defaultSelectionBar()`. It is deliberately not seeded with
a copy of the default: the table in `selection-actions.tsx` stays the one place
that decides what a fresh bar holds, so a reordering there reaches everyone who
never customised the bar, while anyone who did keeps exactly the bar they built.

This is a **device-local preference**, like the gallery's pins: it describes how
this device presents the editor, so it never enters the project document — no
schema bump, nothing for `import-project.ts` to validate. The cost is that a
customised bar does **not** travel with an exported `.midad` file. That is the
intended trade.

**A new action reaches a customised bar through the `⋯` sheet, not the rail.**
The stored value is a list of ids, so a bar saved before an action existed simply
does not mention it — and `overflowActionIds` walks the static `SHEET_ORDER`, so
the action is listed in the sheet, which is also how it gets pinned into the rail.
Appending whatever the stored order is missing would look tidier and would break
**unpinning**: `togglePin` removes an id from the stored list, so a resolver that
re-adds missing ids would put it straight back.

## 9. Copy lives in the help catalog

`resolveSelectionActions(ids, sources)` builds renderable actions, resolving all
copy from `help/catalog.ts` through the key `` `sel.${id}` ``:

| Field   | Source                                                     |
| ------- | ---------------------------------------------------------- |
| `label` | `helpLabel(entry.label, t, language)`                      |
| `role`  | `helpRole(entry, language)`                                |
| `icon`  | `entry.icon` — `undefined` when the catalog omits one      |
| `chord` | `shortcuts.chord(entry.shortcutId)` — `""` on native       |
| `hint`  | `shortcuts.hint(label, entry.shortcutId)`, or just `label` |

A control therefore **cannot end up with two different names**, and **a new action
is a catalog entry plus one line in a table.**

`id`, `hint` and `chord` are three separate fields on purpose: `chord` is the bare
chord the reference list prints beside the label (the way the help sheet does),
and `hint` is the same pair already joined for a tooltip. Both exist rather than
one being derived from the other.

`icon: undefined` is meaningful — it marks a control whose glyph depends on
direction (§10). `danger` comes from `DANGER_ACTIONS` (currently only `delete`)
and wears the danger fill in the sheet.

## 10. `⋯`, disclosure and learn mode

`more` is a `SelectionCommandId`, and it is resolved through the **same
descriptor** as every action, so it inherits a label, role, chord and icon.

Its _press_ is the difference: it is resolved with `disclosure: true`, and
`resolveSelectionActions` binds it **unwrapped** instead of through
`press(key, bound)`:

```ts
onPress: disclosure ? bound : press(key, bound);
```

That makes `⋯` **the one press learn mode does not replace**. It is the only route
to the actions the rail had no room for, so swallowing it would leave those
controls with no explanation on any surface. Off-mode it changes nothing — the
same handler runs either way.

While learning, the `⋯` sheet becomes a centred, scrollable **reference list**
(`SelectionOverflowActions` with `learn`): `HelpCard` + one `HelpRow` per control.
The rows are plain by construction, so there is nothing to intercept — which is
the point, because a sheet of buttons that all explained themselves would never
name any of them. Neither the pins nor the note appear in that mode: a reference
list changes nothing, so it has nothing to choose between.

Every _other_ sheet opener (`styleOpen`, export, text) **is** intercepted and
therefore stays reference-only in learn mode. See
`docs/editor-help-and-learn-mode.md` §5.

## 11. Rendering

### The rail

`SelectionRailActions` renders `actions.slice(0, visibleCount)` then the `⋯`
`IconButton`, in a row styled with `rowStyle(isRTL)`.

**The rail style has no `flexDirection` on purpose** — direction is the caller's
to decide through `rowStyle`, so the row can never be hardcoded one way.

### The `⋯` sheet

One `HelpCard` of rows, in `SHEET_ORDER` and nothing else — deliberately flat,
because the order's whole point is that an action the bar just dropped is near
the top, and a second grouping would be a second order to keep in step with it.

A row carries glyph **and** label — that is the division of labour between the
two surfaces: the rail is the fast path for someone who already knows the
glyphs, and this sheet is where an ambiguous one gets named. The row borrows
`HelpRow`'s geometry (28pt icon box, 16pt glyph, 14pt label, `minHeight: 44`) on
purpose: the sheet the controls are _pressed_ in and the sheet they are _read_
in (learn mode) are one list in one shape, so neither can drift from the other.

The row also supplies the icon the catalog deliberately omits:

```ts
const STEP_DIRECTION = { stylePrev: 'prev', styleNext: 'next' };
```

`stylePrev`/`styleNext` carry no catalog `icon` because **a fixed arrow would read
backwards in Arabic** — the mirroring belongs to the renderer, not to the table.
The row mirrors a `DirectionIcon` from that local map instead.

A row's trailing side holds whatever the control has to say for itself: the bare
`chord` in a `Kbd` where the platform has keys, then the pin. `rowStyle(isRTL)`
places both, so nothing is positioned against the label's wrapping and no side is
hardcoded.

The one sentence above the card is `helpRole(helpEntry("sel.pinToBar"))` —
reused, not rewritten, because it is the half of the mechanism no gesture can
explain for itself.

The pin is a separate `Pressable` inside the row. Its 32pt box plus
`PIN_HIT_SLOP = 6` on all sides takes it to the 44pt floor — and a target that
size cannot spill out of a 44pt row, which is what the row is exactly. The pin
sits in the row's trailing end, the one place the label never reaches, and
mirrors with direction through `rowStyle`.

Both readings of the sheet scroll: the body is a `ScrollView` with
`flexShrink: 1`, because the panel is capped at 82% of the window and a full
sheet holds up to twenty controls. The panel itself is capped at
`layout.maxContent` and centred (`ui/sheet.tsx`), like every other surface's
content — without that, a row list on a wide display would stretch to the width
of the window and read as a ledger.

## 12. Code map

| Concern                                                                  | File                                |
| ------------------------------------------------------------------------ | ----------------------------------- |
| `SelectionActionId`, `RAIL_SLOTS`, `OVERFLOW_ACTIONS`, `SHEET_ORDER`     | `src/editor/selection-actions.tsx`  |
| `SelectionShape`, `isAvailable`                                          | `src/editor/selection-actions.tsx`  |
| `railActionIds`, `overflowActionIds`, `SLOT_INDEX_OF`                    | `src/editor/selection-actions.tsx`  |
| `visibleActionCount` and the geometry constants                          | `src/editor/selection-actions.tsx`  |
| `resolveSelectionActions`, `SelectionAction`, `SelectionPin`             | `src/editor/selection-actions.tsx`  |
| `SelectionRailActions`, `SelectionActionRow`, `SelectionOverflowActions` | `src/editor/selection-actions.tsx`  |
| `STEP_DIRECTION`, `DirectionIcon` usage                                  | `src/editor/selection-actions.tsx`  |
| The sheet panel's width cap and centred presentation                     | `src/components/ui/sheet.tsx`       |
| The collection bar (head, member track, placement)                       | `src/editor/collection-bar.tsx`     |
| The context zone's contents, `hasContext`, the head's copy               | `src/editor/EditorScreen.tsx`       |
| `bar`, `togglePin`, `railIds`, `visibleCount`, measurement callbacks     | `src/editor/EditorScreen.tsx`       |
| `contextRail` slot, `CONTEXT_RAIL_HEIGHT`                                | `src/editor/EditorScreen.tsx`       |
| `selectionBarActions`, `setSelectionBarActions`                          | `src/storage/settings.ts`           |
| `sel.*` labels, roles, icons and chords                                  | `src/editor/help/catalog.ts`        |
| Hint suppression under `onLongPress`                                     | `src/components/ui/icon-button.tsx` |
| `spacing`, `radius`, `typeScale` tokens                                  | `src/theme/tokens.ts`               |
| The rail's layout rule                                                   | `DESIGN.md` §5                      |
