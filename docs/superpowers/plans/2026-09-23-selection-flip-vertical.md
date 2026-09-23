# Flip Vertical Selection Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the selection bar a **Flip vertically** control beside the existing **Flip horizontally** one, so a rotated element can be mirrored top-to-bottom the same way `Shift+V` already does.

**Architecture:** `flipV` already exists as a keyboard action and as a handler (`flipSelection('v')`); it was never registered as a *selection action*, so no button carries it. The fix adds one id to the selection-action table (`OVERFLOW_ACTIONS`, next to `flipH`), binds it to the existing handler, and moves its help-catalog entry from the keyboard-only group to the selection group. The rail keeps showing the highest-priority actions; `flipH`/`flipV` stay in the `⋯` overflow sheet (the contract's stance: flip is already a canvas gesture), where a long-press pins either one to the rail. No new behaviour is written — only wiring.

**Tech Stack:** React Native / Expo, TypeScript, phosphor-react-native icons, the repo's standalone `check-*.mjs` scripts (no test runner).

**Spec:** `docs/editor-selection-bar.md` (the behavior contract for this module) and `docs/editor-help-and-learn-mode.md` (the help-catalog contract). There is no separate spec doc; the contract docs are authoritative.

## Global Constraints

- `src/editor/help/catalog.ts` must declare **only `import type`** — `scripts/check-help.mjs` transpiles and evaluates it standalone; a value import silently breaks the check.
- `src/i18n/strings.ts` must declare **no imports at all** — same standalone check.
- `src/editor/shortcuts.ts` must contain **no React Native and no DOM import**.
- A new help entry's label must reference an existing string (`hint`/`editor`) or carry literal `{ ar, en }`; it may not do both, and the referenced string must exist in **both** languages.
- Roles are literal `roleAr`/`roleEn`, and a role must **not repeat its own label**.
- Every `IconName` used by the catalog must exist in `ICONS` (`src/components/ui/icon.tsx`); the `Record<IconName, …>` makes a missing mapping a type error.
- Do not add a second `.prettierrc`; format with `yarn format:fix` scoped to touched files.
- `SELECTION_ACTION` ids are pure data; `selection-actions.tsx` must not read the editor store.

## Review Focus

Input classes / failure modes this change can trip, most likely first. Each is pinned by a step in the task that owns the code.

1. **`flipV` id added to the table but no icon mapping** → `Icon` looks up `ICONS['flipV']` and renders nothing / throws. (Task 1, Step 6 — typecheck.)
2. **Catalog entry references a hint that does not exist in one language** → learn mode and the sheet render blank. (Task 1, Step 2 — `check-help.mjs` red, Step 4 green.)
3. **`SelectionActionId` gains `flipV` but the `run` record does not** → runtime `run.flipV is not a function`. (Task 1, Step 7 — typecheck red, Step 9 green.)
4. **The stale `key.flipV` entry is left behind** → the help sheet claims flip is keyboard-only ("no button carries it") while a button now does. (Task 1, Step 3.)
5. **A user's customised bar** (`selectionBarActions` stored before `flipV` existed) never mentions `flipV`; it must still appear in the `⋯` sheet, reachable to pin. (`overflowActionIds` walks static `SHEET_ORDER` — Task 1, Step 10 manual QA.)
6. **RTL** — `flipH`/`flipV` glyphs are absolute, not direction-relative, so they must **not** mirror; using the catalog's fixed `icon` (not `DirectionIcon`) is correct. (Task 1, Step 10 manual QA.)

---

### Task 1: Register `flipV` as a selection action

**Files:**
- Modify: `src/i18n/strings.ts` (hints type + `ar` + `en` blocks)
- Modify: `src/components/ui/icon.tsx` (import, `IconName`, `ICONS`)
- Modify: `src/editor/help/catalog.ts` (add `sel.flipV`, remove `key.flipV`)
- Modify: `src/editor/selection-actions.tsx` (`SelectionActionId`, `OVERFLOW_ACTIONS`)
- Modify: `src/editor/EditorScreen.tsx` (`run` record)
- Test/verify: `node scripts/check-help.mjs`, `node scripts/check-shortcuts.mjs`, `npx tsc --noEmit`, `node scripts/verify.mjs`

**Interfaces:**
- Consumes: `flipSelection('v')` (already defined in `EditorScreen.tsx`, line ~1032); `ShortcutId = 'flipV'` (already in `shortcuts.ts:29`, bound to `Shift+V` at line 112); the `helpEntry`/`helpLabel`/`helpRole` helpers from `@/editor/help`.
- Produces: `SelectionActionId` includes `'flipV'`; `run.flipV: () => void`; help key `'sel.flipV'`; `IconName` includes `'flipV'`; hints key `flipV` in `ar`/`en`.

- [ ] **Step 1: Add the `flipV` hint string in both languages**

In `src/i18n/strings.ts`, add the type field after `flipH: string;` (around line 226, inside `editor.hints`):

```ts
      flipV: string;
```

In the Arabic `hints` block, after `flipH: 'قلب أفقي',` (around line 505):

```ts
        flipV: 'قلب رأسي',
```

In the English `hints` block, after `flipH: 'Flip horizontally',` (around line 781):

```ts
        flipV: 'Flip vertically',
```

- [ ] **Step 2: Run the help check to confirm it fails**

Run: `node scripts/check-help.mjs`
Expected: **FAIL** on `every tooltip label belongs to exactly one help entry` — the new `flipV` hint is not claimed by any entry yet.

- [ ] **Step 3: Add the icon, add `sel.flipV`, remove the stale `key.flipV`**

In `src/components/ui/icon.tsx`:

1. Add `FlipVertical` to the phosphor import list, after `FlipHorizontal,` (line 27):

```ts
  FlipVertical,
```

2. Add `'flipV'` to `IconName`, after `| 'flip'` (line 77):

```ts
  | 'flipV'
```

3. Add the mapping in `ICONS`, after `flip: FlipHorizontal,` (line 122):

```ts
  flipV: FlipVertical,
```

In `src/editor/help/catalog.ts`, add a `sel.flipV` entry directly after the `sel.flipH` entry (after line 256):

```ts
  {
    key: 'sel.flipV',
    group: 'selection',
    label: { hint: 'flipV' },
    roleAr: 'قلب التحديد رأسيًا.',
    roleEn: 'Mirror the selection top to bottom.',
    icon: 'flipV',
    shortcutId: 'flipV',
  },
```

Then **delete** the now-stale keyboard-only entry at the end of the array (lines 739-746):

```ts
  {
    key: 'key.flipV',
    group: 'keyboard',
    label: { ar: 'قلب رأسي', en: 'Flip vertically' },
    roleAr: 'قلب التحديد رأسيًا. لا زرّ له في المحرّر.',
    roleEn: 'Mirror the selection top to bottom. No button carries it.',
    shortcutId: 'flipV',
  },
```

Deleting it is required: its role says "No button carries it", which is no longer true, and flipV is now documented by `sel.flipV`. `check-help.mjs` still passes because `sel.flipV` claims the `flipV` shortcut.

- [ ] **Step 4: Run the help check to confirm it passes**

Run: `node scripts/check-help.mjs`
Expected: **PASS** — `All N help entries verified across 6 groups.`

- [ ] **Step 5: Run the shortcut check (should already pass)**

Run: `node scripts/check-shortcuts.mjs`
Expected: **PASS**. The binding table is unchanged; this step guards against an accidental edit.

- [ ] **Step 6: Add the id to the action table**

In `src/editor/selection-actions.tsx`:

1. Add `'flipV'` to the `SelectionActionId` union, after `| 'flipH'` (line 69):

```ts
  | 'flipV'
```

2. Add `'flipV',` to `OVERFLOW_ACTIONS`, after `'flipH',` (line 161):

```ts
  'flipV',
```

- [ ] **Step 7: Run the typecheck to confirm it fails**

Run: `npx tsc --noEmit`
Expected: **FAIL** — `Property 'flipV' is missing in type … but required in type 'Record<SelectionCommandId, () => void>'` in `src/editor/EditorScreen.tsx`. This is the `run` record telling you it is incomplete.

- [ ] **Step 8: Bind the handler**

In `src/editor/EditorScreen.tsx`, add the entry to the selection `run` record, directly after `flipH: () => flipSelection('h'),` (line 1523):

```ts
      flipV: () => flipSelection('v'),
```

- [ ] **Step 9: Run the typecheck to confirm it passes**

Run: `npx tsc --noEmit`
Expected: **PASS** (no output).

- [ ] **Step 10: Run the whole suite and check by hand**

Run: `node scripts/verify.mjs`
Expected: **`11/11 passed`** (typecheck, lint, and all nine `check-*` scripts).

Manual QA (run the app):

1. Select a text object, tap `⋯`, confirm both **Flip horizontally** and **Flip vertically** rows appear, each with a distinct glyph.
2. Press **Flip vertically** → the text mirrors top-to-bottom. Rotate it 90° first and confirm the mirror is perpendicular to the rotated baseline.
3. Long-press **Flip vertically** in the sheet to pin it → it moves to the head of the rail; the rail button mirrors top-to-bottom. Unpin it → it returns to the sheet.
4. Open the help sheet (`?`) → **Selection bar** now lists both flips; the **Keyboard only** section no longer lists flipV.
5. Switch to Arabic → the two labels are distinct (`قلب أفقي` / `قلب رأسي`) and neither glyph mirrors (they are absolute).

- [ ] **Step 11: Commit**

```bash
git add src/i18n/strings.ts src/components/ui/icon.tsx src/editor/help/catalog.ts src/editor/selection-actions.tsx src/editor/EditorScreen.tsx
git commit -m "feat(editor): add flip-vertical selection action"
```

---

### Task 2: Update the selection-bar contract doc

**Files:**
- Modify: `docs/editor-selection-bar.md`

**Interfaces:**
- Consumes: the `SHEET_ORDER` length and `OVERFLOW_ACTIONS` contents from Task 1.
- Produces: doc and code agree (the contract's own requirement: "when code and this document disagree, fix the code" — here the code is the new truth).

- [ ] **Step 1: Add `flipV` to the overflow list and fix its count**

In `docs/editor-selection-bar.md` §2, the line beginning `OVERFLOW_ACTIONS — sheet-only, 13 ids:` (line 54). Change `13 ids` to `14 ids` and add `flipV` after `flipH`:

Current:

```markdown
`OVERFLOW_ACTIONS` — sheet-only, 13 ids: `rotateCcw`, `rotateCw`, `flipH`, the
six `align*`, `centerH`, `centerV`, `stylePrev`, `styleNext`.
```

Replace with:

```markdown
`OVERFLOW_ACTIONS` — sheet-only, 14 ids: `rotateCcw`, `rotateCw`, `flipH`,
`flipV`, the six `align*`, `centerH`, `centerV`, `stylePrev`, `styleNext`.
```

- [ ] **Step 2: Reconcile the two stale control counts**

The doc states a total twice, and both counts had already drifted before this change (the `SelectionActionId` union holds 25 ids today; `SHEET_ORDER` holds 25, and with `flipV` it is 26).

- Line 13 (§1): `A selection owns up to twenty-three controls;` → `A selection owns up to twenty-six controls;`
- Line 416 (§11): `a full sheet holds up to twenty controls.` → `a full sheet holds up to twenty-six controls.`

After editing, verify the numbers by counting the `SelectionActionId` union in `src/editor/selection-actions.tsx` (should be 26) and `SHEET_ORDER` (`RAIL_SLOTS.flat()` = 12, `OVERFLOW_ACTIONS` = 14, total 26). If the union is not 26, fix the doc to the true value rather than the number written here.

- [ ] **Step 3: Sanity-check the doc renders and matches code**

Run: `node scripts/check-help.mjs`
Expected: **PASS** (unchanged — this step only guarantees Task 1 still holds after the doc edit).

- [ ] **Step 4: Commit**

```bash
git add docs/editor-selection-bar.md
git commit -m "docs(editor): flip-vertical is a selection action, not keyboard-only"
```

---

## Self-Review

- **Spec coverage:** `docs/editor-selection-bar.md` §2 (`OVERFLOW_ACTIONS` contents + count) and §9 ("a new action is a catalog entry plus one line in a table") are covered by Tasks 1 and 2. `docs/editor-help-and-learn-mode.md` needs no change: its group table is generic and never names `key.flipV`.
- **Placeholder scan:** No TBD/TODO; every code step shows the literal change with its anchor.
- **Type consistency:** `'flipV'` is used identically across `SelectionActionId`, `OVERFLOW_ACTIONS`, the catalog key `sel.flipV`, `IconName`, and the hints key `flipV`. The help key string is `` `sel.${id}` `` → `sel.flipV` in both the catalog and `resolveSelectionActions`.
- **Review Focus:** Every line names its owning step (see the list above); the typecheck steps cover the icon and `run`-record failure modes, `check-help.mjs` covers the label wiring, and manual QA covers the persisted-bar and RTL cases.
