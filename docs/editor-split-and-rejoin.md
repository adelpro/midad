# Editor Split & Rejoin

> How a word is broken into independently movable parts and put back together —
> the Arabic-specific algorithm at the centre of the editor. This is the behavior
> contract; when code and this document disagree, fix the code.

---

## 1. The problem

Arabic letters change shape according to their neighbours (isolated / initial /
medial / final). Splitting a word per Unicode code point would detach each letter
from its neighbours and change how it renders, so a naive split is not an option.

## 2. Clusters, and why splitting is safe

A **cluster** here is a maximal run of letters the shaper joins into one
continuous stroke. The property that makes splitting safe without touching glyph
paths:

> the first letter of a connected run is always in **initial** form and the last
> is always in **final** form — which is exactly what HarfBuzz picks when that
> same run is shaped on its own.

So shaping a cluster as a standalone string reproduces the original glyph forms
exactly. No glyph-path access, no font surgery.

`مدرسة` → `مد` | `ر` | `سة`

### Joining types

`joiningType(cp)` classifies each code point:

| Type | Meaning                                                    | Joins forward | Joins backward |
| ---- | ---------------------------------------------------------- | ------------- | -------------- |
| `D`  | Dual-joining — connects to both neighbours                 | yes           | yes            |
| `R`  | Right-joining — connects only to the preceding letter      | no            | yes            |
| `C`  | Join-causing — tatweel (`U+0640`) and ZWJ (`U+200D`)       | yes           | yes            |
| `T`  | Transparent — combining marks, never affect joining        | —             | —              |
| `U`  | Non-joining — whitespace, digits, punctuation, Latin, ZWNJ | no            | no             |

Classification is by code-point **ranges**, hand-built from the Unicode joining
tables (`TRANSPARENT`, `RIGHT_JOINING`, `ARABIC_LETTERS`), not by a Unicode
property lookup.

**Unknown letters default to `D`, and that is deliberate.** The comment states the
reasoning: two genuinely connected letters stay together. A wrong split visually
breaks the shape, while a conservative merge merely produces a larger part. When
in doubt, this algorithm merges.

Two details worth knowing:

- `U+0621` (hamza) is deliberately **absent** from `ARABIC_LETTERS` — it never
  joins. It falls through to `U`.
- Combining marks (`T`) always attach to the group they decorate. A **leading**
  mark run keeps the group's `base` as `null`, so the first real letter still
  joins it.

### Segmentation

For each unit, it joins the current group when:

```
base === null  ||  (canJoinForward(base.type) && canJoinBackward(unit.type))
```

otherwise it starts a new group. Then ink-less groups are handled per §3.

## 3. Whitespace lives in `gapBefore`, never as a part

Whitespace and zero-width/formatting characters
(`/[\s\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/u`) are excluded by
`rendersInk`. They affect where a break happens — **ZWNJ in particular exists to
prevent a join** — but draw nothing, so they cannot be a part in their own right.

Instead their text accumulates into the following cluster's `gapBefore`. That is
what makes Rejoin exact: the parts carry everything needed to rebuild the
original string, with no side table.

## 4. Placement: the measure-twice trick

Each part has to land exactly where its ink already was. `splitTextObject`
derives that by **measuring twice**, using the same rect conventions both times:

1. The cluster's tight ink rect **inside the original paragraph**
   (`sourceParagraph.getRectsForRange(cluster.start, cluster.end)`).
2. The same cluster's tight ink rect **in its own standalone paragraph**
   (`partLayout.paragraph.getRectsForRange(0, cluster.text.length)`).

Then:

```
inkX  = sourceRect.x + sourceRect.width  / 2 - sourceW / 2
inkY  = sourceRect.y + sourceRect.height / 2 - sourceH / 2
selfX = partRect.x   + partRect.width    / 2 - partLayout.width  / 2
selfY = partRect.y   + partRect.height   / 2 - partLayout.height / 2
localX = inkX - selfX        localY = inkY - selfY
```

The half-box subtractions convert to the object's local frame, because content is
authored **centred on the origin** (see `docs/editor-coordinates.md` §2).

Subtracting the two centres is what makes this work: **because both measurements
use the same rect conventions, the difference cancels glyph bearings, line-box
height bias and text-alignment rounding.** So splitting does not visibly move the
artwork even though each part is shaped independently.

The local offset is then mapped into design space through the source transform,
which the canvas applies as `translate → rotate → scale`:

```
sx = localX * scaleX        sy = localY * scaleY
offsetX = t.x + sx * cos - sy * sin
offsetY = t.y + sx * sin + sy * cos
```

## 5. What a part inherits

| Field           | Value                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `wrapWidth`     | **always `null`**                                                                                                |
| `zIndex`        | the source's — all parts share one layer                                                                         |
| `part`          | `{ rootId, index, count, gapBefore? }`                                                                           |
| everything else | copied from the source (`fontKey`, `fontSize`, `align`, `color`, `opacity`, `shadows`, `presentation`, `locked`) |

`wrapWidth: null` is not cosmetic: parts always hug their own glyphs. An inherited
wrap width would re-flow them and break the alignment computed in §4.

All parts keeping the source's `zIndex` is what makes them paint in reading order
— a stable sort preserves their array order (see
`docs/editor-state-and-history.md` §5).

## 6. Failure modes

`SplitFailure` — split refuses rather than produce a misplaced part:

| Reason             | When                                                |
| ------------------ | --------------------------------------------------- |
| `already-a-part`   | `source.part` is set — no nested splitting          |
| `too-few-clusters` | fewer than 2 clusters (nothing to separate)         |
| `cluster-wrapped`  | a cluster's `getRectsForRange` returns **≠ 1 rect** |
| `layout-failed`    | the paragraph could not be laid out (fonts missing) |

`cluster-wrapped` is the interesting one: a cluster that straddles a **soft wrap**
has no single position to move to, so the split is refused. It is checked on both
the source rect and the standalone part rect.

Temporary paragraphs are disposed in `finally` blocks — `partLayout` per
iteration and `sourceParagraph` around the whole loop — so a refusal part-way
through does not leak.

## 7. Rejoin

`mergePartTexts(parts)` rebuilds the original string from the parts' own
(possibly edited) text plus the separators captured at split time:

1. **Refuse unless complete**: `parts[0].part.count` must be defined and
   `parts.length` must equal it. A partial selection is never silently merged.
2. Sort by `part.index`.
3. Join `(part.gapBefore ?? "") + part.text` in order.

Because `gapBefore` holds the whitespace, this is lossless — including when a part
was edited in place, since each part contributes its _current_ text.

`EditorScreen.rejoinSelected` then centres the merged object on the group's
**centroid** (the mean of the parts' `x`/`y`), not on whichever part sorted first,
and calls `mergeObjectParts` so the whole rejoin is one undoable step.

## 8. Store wiring

Both directions are **single undoable steps** that snapshot once:

- `splitObjectIntoParts(sourceId, parts)` — the parts take over the source's slot
  in the objects array and are stamped with a `groupId` (the source's own when it
  was grouped, a fresh one otherwise), so the word becomes a **collection**: one
  element the user can move, scale and rotate whole, and step back into letter by
  letter. The selection lands **entered** on the first part, so splitting still
  drops the user straight into editing letter by letter.
- `mergeObjectParts(merged, partIds)` — removes the parts, inserts the merged
  object at the first removed part's index, and selects it. The merged object
  inherits the membership its parts shared.

The two features stay independent where it matters: **rejoin is keyed on
`part.rootId`**, not on membership, so ungrouping a word does not destroy the
ability to rejoin it, and the collection bar's member track (membership) and the
rejoin action (provenance) derive from different lookups. See
[`editor-collections.md`](editor-collections.md) §1 and §6.

## 9. The executable spec

`scripts/check-clusters.mjs` is the real specification for `segmentClusters`.
There is no test runner in this repo, so the script transpiles
`clusters.ts` in memory with the installed TypeScript and evaluates it
standalone — no tsconfig, no `@/` alias resolution, nothing written to disk.

It asserts three groups:

**11 segmentation cases** — the reference word `مدرسة` → `مد|ر|سة`; lam-alef `لا`
forming one ligature; a fully connected word staying whole (`كتب`); spaces
carried as `gapBefore` (`بسم الله` → `بسم|ا|لله`); harakat travelling with their
letter (`مَدْرَسَة` → `مَدْ|رَ|سَة`); tatweel merging its neighbours (`مـد`); ZWNJ
forcing a break (`م\u200cد` → `م|د`); hamza never joining (`سمء` → `سم|ء`); Latin
splitting per letter (`hello`); a combining mark staying with its base (`e\u0301x`);
digits being non-joining (`٢٠٢٦`).

**5 round-trip cases** — `مدرسة`, `بسم الله`, `مَدْرَسَة`, `hello world`, `كتب` must
rebuild exactly from `gapBefore + text`. This is what makes the split reversible
from the saved parts alone.

**4 guard cases** — `canSplitIntoClusters` must be `false` for `كتب`, `لا` and
`"   "`, and `true` for `مدرسة`.

**Run `node scripts/check-clusters.mjs` after touching `clusters.ts`.** It exits
non-zero on failure. Add a case for any joining behaviour you change — the
default-to-`D` rule and the range tables are exactly the kind of thing that
silently regresses.

## 10. Code map

| Concern                                                  | File                            |
| -------------------------------------------------------- | ------------------------------- |
| `segmentClusters`, `canSplitIntoClusters`, `joiningType` | `src/editor/text/clusters.ts`   |
| Joining-type ranges, `INVISIBLE_CHARS`, `rendersInk`     | `src/editor/text/clusters.ts`   |
| `TextCluster`, `JoiningType`                             | `src/editor/text/clusters.ts`   |
| `splitTextObject`, `mergePartTexts`, `SplitFailure`      | `src/editor/text/split.ts`      |
| Shaping used by both directions (`layoutArabicText`)     | `src/editor/skia/text.ts`       |
| `splitObjectIntoParts`, `mergeObjectParts`               | `src/editor/store.ts`           |
| Split/rejoin UI entry points, centroid rejoin            | `src/editor/EditorScreen.tsx`   |
| `TextPartRef` (`rootId`, `index`, `count`, `gapBefore`)  | `src/storage/project-schema.ts` |
| Executable spec                                          | `scripts/check-clusters.mjs`    |
