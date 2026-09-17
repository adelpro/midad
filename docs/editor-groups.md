# Editor Groups

> How several objects become one element in the midad editor: the membership
> field, the invariant the whole feature rests on, and what a group deliberately
> does not do. This is the behavior contract; when code and this document
> disagree, fix the code.

---

## 1. What a group is

A group is a set of objects the editor treats as **one element**. Tapping any
member selects them all; they then move, nudge, duplicate, restack, delete and
restyle together, and the selection bar, the count badge and the align actions
all treat them as a single thing.

The feature exists because the editor already knew how to move several objects at
once (the multi-selection group drag) — what it lacked was a way to make that
grouping _persist_, so it survives a tap on empty space, a save, and a reload.

## 2. The model: one field, no container

Membership is a single optional field on the object:

```ts
interface GroupMember {
  groupId?: string;
}
```

`CalligraphyTextObject`, `GlyphObject` and `ShapeObject` all extend it, and
nothing else in the document changes. This mirrors `TextPartRef` — the split-word
feature's provenance record — for the same reason: **the document model stays
flat**. Hit-testing, gestures, the canvas, the PNG renderer and the SVG
serializer all go on seeing an ordinary list of objects, and none of them knows
that groups exist. There is no group record to keep in sync, nothing to
re-parent, and no traversal that can go stale.

The costs of that choice, stated plainly:

- A group has no name, no own transform and no own z-index. It is defined by its
  members, and it disappears the moment they stop sharing an id.
- Membership is written per object, so grouping is one pass over the selection.
- `groupId` is inert metadata: the export paths enumerate fields by hand, so an
  unknown key is carried through import and export untouched and never reaches a
  renderer. **Adding it required no change to `render/offscreen.ts`,
  `export/svg.ts`, `storage/import-project.ts` or `EditorCanvas.tsx`.**

`PROJECT_FILE_VERSION` is deliberately **not** bumped: the field is optional, so
an older file simply has no groups, and a newer file read by an older build keeps
the key on round-trip without understanding it.

## 3. The invariant: a selection is always whole groups

**`selectedIds` is always a union of whole groups.** A group can never be
half-selected.

Everything else in this document is a consequence of that one rule. It is what
lets `updateDrag`, `nudgeSelected`, `removeObjects`, `duplicateObjects`,
`alignSelected` and the style edits act on "the selection" and be correct about
groups without knowing about them.

It is enforced in `src/editor/groups.ts` and applied at every write:

| Write                                       | What keeps it whole                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `select(id, additive)`                      | `expandToGroups([id])`; the additive toggle removes the whole group the tap landed on |
| `setMultiSelectMode(false)`                 | collapses to `expandToGroups([lastId])`, never to a single member                     |
| `removeObjects`                             | re-expands what survives                                                              |
| `splitObjectIntoParts` / `mergeObjectParts` | re-expands from the resulting object                                                  |
| `duplicateObjects`                          | re-expands the clones                                                                 |
| `restorableSelection` (undo/redo)           | filters to the entry's own objects, then re-expands                                   |

`expandToGroups` puts the **touched id first** and its group's other members
after it in document order. That matters because `selectedIds[0]` is the primary
every single-object read uses (`selectedObject`, `liveText`, the style panel): a
tap on a member therefore makes _that_ member the one the panel describes, and
the rest of the group follows it.

## 4. What a group does

| Interaction                                           | Behaviour                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Tap a member                                          | Selects the whole group                                                                         |
| Tap empty space                                       | Clears the selection                                                                            |
| Drag a member                                         | Moves the whole group (the existing multi-selection drag, from per-object captured origins)     |
| Arrow keys                                            | Move the whole group, one coalesced history entry per burst                                     |
| Delete                                                | Deletes the whole group                                                                         |
| Duplicate                                             | Copies the group as a **new group** (fresh id, so the copy and the original move independently) |
| Bring to front / send back                            | Applies to the whole group at one z-index, so its internal layering is preserved                |
| Ink swatch                                            | Recolours every member (`color` is the one style field all three object types carry)            |
| Style presets, font size, leading, opacity, alignment | Applied to every selected **text** object, each resolved against its own properties             |
| Align / centre                                        | Moves each **element** as a whole (§5)                                                          |
| Count badge                                           | Counts elements, not objects — a group of three reads as `1`                                    |

Style edits deliberately stop at text objects for text-only fields: writing
`fontKey` onto an ornament would be inert at best and a type error at worst. Ink
and opacity are the fields every type understands, so they reach the whole
selection.

## 5. Align works on elements, not objects

`computeAlignUpdates` takes the selection already split into **units** — one
group, or one lone object (`selectionUnits`).

- **Relative modes** (`left`, `centerH`, `right`, `top`, `middleV`, `bottom`)
  align the outermost _unit_ and move every unit as a whole. Without this, the
  align family would be actively destructive on a group: aligning "left" would
  snap each member's own left edge to the group's left edge and stack the members
  on top of each other.
- **`canvasCenterH`/`V`** translate the whole selection by the distance between
  its bounding box and the canvas centre. For a single object that is identical
  to the old behaviour (the object's `transform.x/y` _is_ its centre); for a
  multi-selection it centres the selection instead of stacking every object on
  the canvas centre.

A lone object is a one-object unit, which is why a plain multi-selection aligns
exactly as it always has.

The count badge and the rail's `isMulti` both count units, so a group of three
offers the same actions a single object does. That is the point of a group: it
behaves as one element. Align is the one family that needs at least two elements
to say anything, so it disappears for a lone group.

## 6. What a group does not do

- **No resize or rotate.** Handles remain single-object (`selectedIds.length ===
1`), and pinch/two-finger rotate stays inert for any multi-selection, because a
  group has no unambiguous pivot. A group is scaled the way any multi-selection
  is: with the rail's `scaleUp`/`scaleDown`, which apply one transform to every
  member.
- **No "enter group".** A tap always resolves to the whole group. Editing one
  member means ungrouping, editing, and grouping again — one invariant instead of
  a mode with its own escape hatch.
- **No nesting.** `canGroup` refuses a selection that already contains a grouped
  object: one owner per object keeps membership a single field with no parent
  chain to walk. Group a subset by ungrouping first.
- **No marquee/lasso.** `hitTest` still resolves a point to one object id; the
  group is applied afterwards, in `select`.
- **No group chrome.** A group selection draws the same dashed box a
  multi-selection always did (`GroupSelectionOverlay`), with no handles.

## 7. Availability

| Action    | Offered when                                                                          |
| --------- | ------------------------------------------------------------------------------------- |
| `group`   | Two or more elements are selected, and **no** selected object already has a `groupId` |
| `ungroup` | The selection is exactly one whole group, and nothing else                            |

Both predicates live in `groups.ts` and are the same ones the store mutators call,
so the button and the behaviour cannot disagree.

The two actions share **one rail slot** — a selection is either a set of loose
elements or one whole group, never both — placed after the split/rejoin slot.
`Ctrl/Cmd+G` groups and `Ctrl/Cmd+Shift+G` ungroups; the grid toggle keeps the
bare `G`.

A **mixed selection** (one whole group plus loose objects) offers neither action:
grouping is blocked by the no-nesting rule and ungrouping by the
exactly-one-group rule. Tapping the group alone is the way out.

`ungroup` switches the multi-select mode **on**, and `group` switches it **off**.
Both follow from the same rule the store already documents for `selectAll`: the
mode must agree with what the selection _is_, or the badge and the align actions
appear while the next tap replaces the selection instead of adding to it.

## 8. Lifecycle: a group is never left with one member

A one-member group is not a group — it would keep the badge, the group-only
actions and the dashed box saying "element" about a single object, and no user
could produce one on purpose. `dissolveSingletonGroups` clears membership from
any group that has fallen below two members, and it runs inside the **same
`set()`** as the mutation that shrank it, so one undo restores both the objects
and their membership:

| Mutation               | How a group shrinks                                                              |
| ---------------------- | -------------------------------------------------------------------------------- |
| `removeObjects`        | Deleting members can leave one behind                                            |
| `mergeObjectParts`     | Re-joining a word that was itself the whole group leaves the merged object alone |
| `splitObjectIntoParts` | The source is replaced by its parts, which inherit its membership                |

`splitObjectIntoParts` and `mergeObjectParts` also **inherit** membership: the
parts of a grouped word stay in the group, and a merged word inherits the
membership its parts shared. Splitting or re-joining a member must not silently
dissolve the group around it.

`duplicateObjects` goes the other way: every clone that had a `groupId` gets a
**fresh** one, shared by the whole copy. Sharing the source's id would make the
copy and the original a single group, so dragging either would drag both. A copy
of a single member dissolves back to standalone (via the singleton rule above).

History needs no special handling beyond `restorableSelection`: `clone` copies
each object shallowly and one level of `transform`, and `groupId` is a flat field,
so a snapshot carries membership with it and undo/redo restores groups exactly.

## 9. Code map

| Concern                                                                               | File                                                |
| ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Membership field, `GroupMember`                                                       | `src/storage/project-schema.ts`                     |
| Expansion, units, predicates, dissolve, duplicate remap, `newGroupId`                 | `src/editor/groups.ts`                              |
| The invariant at every selection write, `groupSelected`/`ungroupSelected`             | `src/editor/store.ts`                               |
| Element-aware alignment                                                               | `src/editor/align.ts`                               |
| Element count for the badge, style edits over the selection, the rail's behaviour map | `src/editor/EditorScreen.tsx`                       |
| `group`/`ungroup` ids, availability, the shared rail slot                             | `src/editor/selection-actions.tsx`                  |
| `Ctrl/Cmd+G` and `Ctrl/Cmd+Shift+G`                                                   | `src/editor/shortcuts.ts`                           |
| Help entries `sel.group` / `sel.ungroup`, hint copy                                   | `src/editor/help/catalog.ts`, `src/i18n/strings.ts` |
| Icons                                                                                 | `src/components/ui/icon.tsx`                        |
| Executable spec                                                                       | `scripts/check-groups.mjs`                          |

## 10. Related documents

| Document                                                     | Relationship                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [`editor-selection.md`](editor-selection.md)                 | §2/§4 own how a press resolves; this document adds the group step to that resolution          |
| [`editor-gestures.md`](editor-gestures.md)                   | §2 owns `beginDrag`, which reads the resolved selection back before capturing drag origins    |
| [`editor-state-and-history.md`](editor-state-and-history.md) | §2 owns the mutator split; §7 owns the store slices this document writes through              |
| [`editor-selection-bar.md`](editor-selection-bar.md)         | §2/§3 own the slot table and the availability table the two actions plug into                 |
| [`editor-split-and-rejoin.md`](editor-split-and-rejoin.md)   | The other flat-provenance feature (`part`), and the split/merge paths that inherit membership |
