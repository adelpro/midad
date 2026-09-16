# Editor Help & Learn Mode

> The help catalog, the three surfaces that read it, and learn mode. This is the
> behavior contract; when code and this document disagree, fix the code.

---

## 1. One table, three surfaces

`src/editor/help/catalog.ts` is the **single source of truth** behind every
tooltip, the learn-mode explanation, and the help sheet. Nothing else holds help
copy.

| Surface              | Reads                | Shows                                                      |
| -------------------- | -------------------- | ---------------------------------------------------------- |
| Tooltip (via `hint`) | label                | The short label, plus its chord where a key can be pressed |
| Learn mode           | `role`               | One sentence, in the UI font                               |
| Help sheet           | label + role + chord | A grouped reference, per control                           |

Because there is one table, **a control cannot have two names**, and a new
control is a catalog entry plus one line at its call site.

## 2. Catalog shape

```ts
interface HelpEntry {
  key: string; // stable id, also the learn-mode selection key
  group: HelpGroup;
  label: HelpLabel;
  roleAr: string; // what the control does, one sentence
  roleEn: string;
  icon?: IconName; // omitted when the icon depends on direction
  shortcutId?: ShortcutId;
}
```

The table holds **71 entries across 6 groups** at the time of writing — the check
script prints the live count.

### The label union

`HelpLabel` is what keeps the table from becoming a second copy of the string
catalog:

| Form                    | Source                                           |
| ----------------------- | ------------------------------------------------ |
| `{ hint: HintsKey }`    | An existing `t.editor.hints.*` key               |
| `{ editor: EditorKey }` | An existing `t.editor.*` key outside `hints`     |
| `{ ar, en }`            | New copy for a control that had no string before |

Labels are **referenced, not retyped**. `{ ar, en }` is the escape hatch for the
controls that genuinely had no string — the colour swatches, the sheet buttons,
the keyboard-only actions. **Roles are always literal `roleAr`/`roleEn`**, because
they are new prose rather than a control name.

`HintsKey` and `EditorKey` are derived from `Translation`, so a label cannot point
at a key that does not exist in the type.

### `icon` is optional on purpose

> Omitted where the icon depends on direction: previous/next controls mirror in
> Arabic, and a fixed left-pointing glyph would read backwards.

The _renderer_ supplies the mirroring instead — see
`docs/editor-selection-bar.md` §11 (`STEP_DIRECTION` + `DirectionIcon`).

### Groups

`HELP_GROUPS` is also the sheet's section order:

| Group       | Heading (en)    |
| ----------- | --------------- |
| `topBar`    | Top bar         |
| `tools`     | Tools           |
| `selection` | Selection bar   |
| `canvas`    | Canvas gestures |
| `panels`    | Panels          |
| `keyboard`  | Keyboard only   |

## 3. Resolution helpers

| Helper                               | Behaviour                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `HelpKey`                            | A **derived** literal union — `(typeof HELP_ENTRIES)[number]["key"]` — so adding an entry widens it automatically |
| `helpEntry(key)`                     | Looks up `BY_KEY`; **throws** `Unknown help key: …`                                                               |
| `helpLabel(label, t, language)`      | Resolves the union to a string                                                                                    |
| `helpRole(entry, language)`          | `roleAr` or `roleEn`                                                                                              |
| `helpGroupLabel`, `helpGroupEntries` | Section heading and its entries, in table order                                                                   |

`helpEntry` **throws rather than returning undefined**: a typo should fail loudly,
not render blank. `helpGroup` does the same.

`HELP_ENTRIES` is declared `as const satisfies readonly HelpEntry[]`, which is what
makes the `HelpKey` derivation possible.

## 4. The catalog must stay `import type`-only

Like `shortcuts.ts`, the catalog is **deliberately free of runtime imports — only
`import type`** — so `check-help.mjs` can transpile and evaluate it standalone.
`transpileModule` erases type-only imports, so the module evaluates with no `@/`
alias resolution and leaves nothing on disk.

**Adding a value import silently breaks the check.**

`strings.ts` carries the same constraint, and the check asserts it too: it must
declare **no imports at all**.

## 5. The executable spec

`scripts/check-help.mjs` evaluates `catalog.ts`, `strings.ts` and `shortcuts.ts`
in memory and asserts:

**Standalone-ness**

1. `catalog.ts` declares no runtime imports (only `import type`).
2. `strings.ts` declares no imports.

**Shape** 3. Every help key is unique and non-blank. 4. Every entry's `group` is declared in `HELP_GROUPS`. 5. Every label uses **exactly one** source form — either `ar`+`en` together, or
exactly one of the namespaces. A half-written literal (`ar` without `en`)
fails.

**Labels resolve** 6. Every referenced `hints.*` / `editor.*` key exists and is non-empty **in both
languages**. 7. Every literal label is written in both languages.

**Coverage — the assertion that keeps the reference honest** 8. **Every `t.editor.hints.*` key is claimed by exactly one entry.** This is what
stops the sheet going stale as controls are added. 9. A `hints` key is never claimed twice. 10. The allowlist (`NON_LABEL_HINTS = ["partLabel"]`) holds only non-labels.

`partLabel` is a **format template** (`"Part {n} of {total}"`), not the label of a
control, so no entry can claim it. It is listed rather than pattern-matched so that
adding a real label key later cannot slip past unnoticed.

**Roles say something** 11. Every role is non-empty in both languages **and does not repeat its own
label**. A role that repeats its label "reads as documentation but says
nothing" — the exact failure this table exists to avoid.

**Shortcuts** 12. No entry names an unknown `ShortcutId`, and **every bound shortcut is
documented** — the sheet claims to list them all, so a missing one would make
that claim false.

**Structure** 13. No help group is empty. 14. **No role hardcodes a chord** — no `⌘`, `⇧`, `Ctrl+`, or `Shift+` in either
language. Chord text comes from the shortcut table, never from help copy.

**Run `node scripts/check-help.mjs` after touching the catalog or `strings.ts`.**
It exits non-zero on failure. There is no VS Code task for it (unlike the cluster
and shortcut checks), so it is easy to forget — run it by hand.

## 6. The two-file coupling

Adding a `t.editor.hints.*` key **requires** a catalog entry: assertion 8 fails
otherwise. Adding an entry that points at a missing key fails assertion 6.

The failure mode is worth knowing: the check does not report "entry X is stale".
When the catalog names a key `strings.ts` no longer defines, the script **throws**
(`Cannot read properties of undefined (reading 'trim')`) from deep inside the role
comparison — pointing at the _check_ rather than at the entry that is actually
wrong. **The two files must move together.**

## 7. Tooltips

`IconButton` computes `hintEnabled = !isWeb && !!hint`, so:

- **Web renders no tooltip bubble at all** — the bubble is never fed and the
  `onHoverIn`/`onHoverOut` handlers are not even attached.
- On native, a tooltip shows the label plus its chord.

`hintPlacement` (`"above" | "below"`) therefore only concerns native. It exists
because a top-bar hint rendered above a bar that starts at y 0 (no `env()`
safe-area inset on web) was clipped off the viewport; the editor top bar passes
`"below"`.

**`IconButton` suppresses its own hint bubble whenever a caller passes
`onLongPress`** — one gesture, one meaning. That is why the selection rail's
long-press (the pin) means rail buttons never show a tooltip, and why naming a
button on web goes through learn mode instead.

A tooltip carries **what the control does not already show**: the label for
icon-only buttons, the role for the five captioned tools.

## 8. Learn mode

`useHelpMode()` owns `{ active, activeKey, toggle, exit, press }`.

State is **local `useState` in `EditorScreen`** — no store, no context. Every
control it annotates (including the buttons inside the three editor sheets) is
rendered by `EditorScreen` itself, so there is no tree boundary to cross and
nothing to provide. That also keeps the mode's blast radius to the editor screen,
which is the whole of its scope.

### `press` REPLACES the action

```ts
const press = (key, action) =>
  active
    ? () => {
        hapticTick();
        setActiveKey(key);
      }
    : () => action?.();
```

While learning, a press **explains the control and changes nothing**. That is the
whole point of the mode — a user tapping "delete" to find out what it does must
not lose their work — so it is deliberately **not** a "show a hint and also fire"
decorator.

Off-mode it is a plain pass-through, so a call site reads the same either way:

```ts
onPress={help.press("sel.delete", deleteSelected)}
```

`toggle` and `exit` both clear `activeKey`: entering should start with nothing
explained, and leaving should not remember one. `toggle` fires a `hapticTick()`.

## 9. The `⋯` exception

**One press is deliberately not bound through `press`:** a control that _reveals_
other annotated controls. That is the selection rail's `⋯`, resolved through
`SelectionActionSources.disclosure` and bound unwrapped.

It has to keep working while learning, or the actions it hides could never be
inspected — and it is the only route to them. This is also why the overflow sheet
has a read-only form to open into: while learning it becomes a centred, scrollable
**reference list** (`HelpCard` + one `HelpRow` per control) instead of a grid of
buttons.

A sheet of self-explaining buttons would never _name_ anything, which is exactly
what the reference list fixes.

## 10. What learn mode does not reach

Every other sheet opener — `styleOpen`, export, text — **is** intercepted, so
those sheets stay reference-only in learn mode: their contents are explained by
the catalog entries that own them, not by opening them.

`FontSizeGauge`'s internal stepper is **not interceptable** (it is a gesture on a
gauge, not a bound press), so its three entries are reference-only too.

## 11. The explanation overlays

**`HelpSheet` (`help-sheet.tsx`) and `LearnOverlay` (`learn-overlay.tsx`) are
live.** `EditorScreen` mounts both:

- the `?` button in the top bar opens `HelpSheet`, bound through
  `help.press("topBar.help", …)` so that in learn mode it explains itself
  instead of opening;
- `HelpSheet`'s "Learn mode" button calls `help.toggle()` and closes the sheet;
- `LearnOverlay` is mounted inside the canvas wrapper whenever `help.active` is
  true, reading `help.activeKey` for the banner;
- the overlay's "All tools" button and the `?` chord both leave learn mode
  (`help.exit()`) before opening the sheet, so the sheet's "Learn mode" button
  always turns the mode on, never off;
- object gestures are gated on `!help.active`, so the canvas is inert while
  learning — there is nothing to grab when every press is an explanation.

`HelpCard` and `HelpRow` are live through `selection-actions.tsx` (the learn-mode
overflow list) and through `HelpSheet`'s group cards.

## 12. Code map

| Concern                                                                    | File                                |
| -------------------------------------------------------------------------- | ----------------------------------- |
| `HELP_ENTRIES`, `HELP_GROUPS`, all help copy                               | `src/editor/help/catalog.ts`        |
| `HelpLabel`, `HelpEntry`, `HelpGroup`, `HelpKey`                           | `src/editor/help/catalog.ts`        |
| `helpEntry`, `helpLabel`, `helpRole`, `helpGroupEntries`, `helpGroupLabel` | `src/editor/help/catalog.ts`        |
| `useHelpMode`, `HelpMode.press`                                            | `src/editor/help/use-help-mode.ts`  |
| `HelpRow`, `HelpCard` (live, shared with the overflow list)                | `src/editor/help/help-list.tsx`     |
| `HelpSheet` (mounted by `EditorScreen`)                                    | `src/editor/help/help-sheet.tsx`    |
| `LearnOverlay` (mounted by `EditorScreen`)                                 | `src/editor/help/learn-overlay.tsx` |
| Barrel + the exports                                                       | `src/editor/help/index.ts`          |
| Learn-mode overflow reference list, `disclosure`                           | `src/editor/selection-actions.tsx`  |
| `help.press` wiring, `learn={help.active}`, `?` button, both overlays      | `src/editor/EditorScreen.tsx`       |
| `sel.*` copy the selection bar borrows                                     | `src/editor/help/catalog.ts`        |
| `t.editor.hints.*` strings                                                 | `src/i18n/strings.ts`               |
| `hintEnabled`, hint suppression, `hintPlacement`                           | `src/components/ui/icon-button.tsx` |
| Chord text (`chord`, `hint`)                                               | `src/editor/shortcuts.ts`           |
| Executable spec                                                            | `scripts/check-help.mjs`            |
