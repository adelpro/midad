# Editor Keyboard Shortcuts

> The binding table, the matcher, the web listener, and the chord text. This is
> the behavior contract; when code and this document disagree, fix the code.

---

## 1. Scope

The keyboard layer is **web-only in effect**. `use-keyboard-shortcuts.web.ts` is
the only implementation that listens; the native sibling is an inert stub. Metro
resolves the `.web` sibling on web and the stub everywhere else, so `EditorScreen`
calls one platform-agnostic hook.

Every action routed here **already exists as a button** — the keyboard only adds a
key, so the two paths cannot drift apart.

## 2. `shortcuts.ts` must stay import-free

`src/editor/shortcuts.ts` declares **no React Native and no DOM import**, on
purpose:

- `scripts/check-shortcuts.mjs` transpiles and evaluates it standalone
- the native stub imports it, so an import here would couple the keymap to a
  platform
- no DOM type can be evaluated in a native bundle

`check-shortcuts.mjs` asserts this with a source regex, so **adding a value import
silently breaks the check.** The DOM listener lives in the `.web` file instead.

## 3. The binding table is the single source of truth

`SHORTCUT_BINDINGS` drives **both** key matching and the chord text shown in
tooltips, so a rebind cannot leave a stale hint behind.

21 actions, 23 bindings (Delete and Redo each carry an alternate):

| Action                                        | Binding                                 |
| --------------------------------------------- | --------------------------------------- |
| `delete`                                      | `Delete` **and** `Backspace`            |
| `undo`                                        | `Ctrl/Cmd+Z`                            |
| `redo`                                        | `Ctrl/Cmd+Shift+Z` **and** `Ctrl/Cmd+Y` |
| `duplicate`                                   | `Ctrl/Cmd+D`                            |
| `selectAll`                                   | `Ctrl/Cmd+A`                            |
| `save`                                        | `Ctrl/Cmd+S`                            |
| `clearSelection`                              | `Escape`                                |
| `nudgeLeft/Right/Up/Down`                     | arrows, `shift: "any"`, `repeat: true`  |
| `flipH` / `flipV`                             | `Shift+H` / `Shift+V`                   |
| `rotateCcw` / `rotateCw`                      | `Shift+E` / `Shift+R`                   |
| `bringToFront` / `sendToBack`                 | `Ctrl/Cmd+]` / `Ctrl/Cmd+[`             |
| `toolSelect` / `toolMultiSelect` / `toolText` | `V` / `M` / `T`                         |
| `toggleGrid`                                  | `G`                                     |

`ShortcutBinding` fields:

| Field    | Meaning                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`    | `event.key` to match — **layout-dependent**, so only for named keys                                                                                                 |
| `code`   | `event.code` to match — **layout-independent**, the right choice for letters                                                                                        |
| `mod`    | Requires the platform modifier; **accepts either Meta or Ctrl**, so one table works on macOS and elsewhere. The chord _text_ is what distinguishes them to the user |
| `shift`  | `true` requires Shift, `false`/absent requires it released, `"any"` allows both                                                                                     |
| `repeat` | Whether auto-repeat is allowed                                                                                                                                      |

Notes worth keeping:

- **Delete and Backspace both remove.** Delete is the labelled key on full
  keyboards, Backspace on laptop ones.
- **Ctrl+Y is the Windows habit for redo, and it is deliberately not advertised**
  — the chord text comes from the _first_ declared binding, which is
  `Ctrl+Shift+Z`.
- **Escape closes sheets through react-native-web's own `Modal` listener**, so
  this binding only ever runs while no sheet is open (and `enabled` is `false`
  while a sheet is open — §5).

## 4. Letters bind by `code`, not `key`

This is the single most important decision in the file:

> `key` reports the character the active layout produces. On an Arabic layout the
> physical `V` key yields **`"ر"`**, which would leave every letter shortcut dead.
> `code` names the physical key instead, so the bindings work on any layout.

`check-shortcuts.mjs` pins this with a dedicated case: `{ code: "KeyV", key: "ر" }`
must resolve to `toolSelect`. Named keys (arrows, `Delete`, `Escape`) use `key`,
because those report consistently.

## 5. The web listener

One `keydown` listener on **`document`**.

### Why not the canvas element

The canvas is a Skia surface with **no focus of its own** — a mouse user never
focuses it. And react-native-web's `Modal` **portals sheets out of the editor's
subtree**, so a subtree listener would miss keys while a sheet is open, which is
exactly when `enabled` turns the layer off.

### Bail conditions, in order

| Check                          | Why                                                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `!options.enabled`             | A sheet owns the keyboard while it is open — which is also what lets react-native-web's own Escape handler close it unimpeded                                                                                        |
| `isTypingTarget(event.target)` | A focused text field owns every key: typing must never double as a command. Matches `INPUT`, `TEXTAREA`, `SELECT`, and `contentEditable` — tooltips and labels are not form fields, so this only matches real inputs |
| `event.defaultPrevented`       | Something earlier in the document already handled the keystroke                                                                                                                                                      |
| `matchShortcut` returns null   | Nothing claims the key                                                                                                                                                                                               |
| no handler for the id          | The action is not wired on this screen                                                                                                                                                                               |

### Then: claim the key _before_ acting

`event.preventDefault()` runs before the handler, because **every binding has a
browser default worth suppressing**: Ctrl+S saves the page, Ctrl+D bookmarks it,
Ctrl+A selects it, and the arrows and Backspace scroll it or navigate away.

The handler receives `{ shift, repeat }` — the per-press context, which the nudge
bindings need because they accept Shift either way and pick their distance from
it.

### Attachment

The options object is rebuilt every render, so it is held in a **ref**: the
listener attaches once for the life of the screen and always reads current
handlers and the current `enabled` flag through it.

## 6. `matchShortcut` rejections

Rejected before any binding is considered:

- **`event.isComposing`** — an in-flight IME composition owns the keystroke;
  stealing it would break composition-based input.
- **`event.altKey` — ANY Alt.** AltGr reports as Ctrl+Alt on several Windows
  layouts, so requiring Alt to be released keeps the characters those layouts
  produce out of the way.

Then, per binding, a binding is skipped when:

- its `key`/`code` does not match the event (a binding with neither is skipped)
- **`!!binding.mod !== mod`** — an _undeclared_ modifier must be released, or
  Ctrl+Shift+Z would also be read as Ctrl+Z and **redo would undo first**
- the `shift` requirement fails (`"any"` accepts both)
- **`event.repeat` is set and the binding has no `repeat`**

Auto-repeat is harmless while moving a selection and harmful for one-shot
commands, which would otherwise fire dozens of times as a key is held. Only the
four arrow nudges opt in.

`matchShortcut` returns the **binding**, not the action, so the caller can read
the modifiers it declared — the nudge bindings rely on the press context to pick a
distance, not on the binding.

## 7. Nudge coalescing constants

| Constant            | Value | Role                                                                              |
| ------------------- | ----- | --------------------------------------------------------------------------------- |
| `NUDGE_STEP`        | `1`   | One design unit per press                                                         |
| `NUDGE_STEP_LARGE`  | `10`  | Shift moves ten times as far                                                      |
| `NUDGE_COALESCE_MS` | `400` | A burst of nudges shares one snapshot (see `docs/editor-state-and-history.md` §6) |

Holding an arrow auto-repeats at roughly 30 presses/second, so without coalescing
one held key would flush the whole 50-entry undo stack of useful history. The
window is asserted to be `> 0 && < 500` — shorter than the gap between two
deliberate presses.

## 8. Chord text

`buildShortcutHints(isMac)` is the surface tooltips and the help sheet read:

| Function            | Result                                                  |
| ------------------- | ------------------------------------------------------- |
| `chord(id)`         | e.g. `"⇧⌘Z"` — the first declared binding's chord       |
| `hint(label, id)`   | `"Undo · ⌘Z"`, or just the label when there is no chord |
| `NO_SHORTCUT_HINTS` | `chord` returns `""`, `hint` returns the label alone    |

`formatChord(binding, isMac)` differs by platform, following each convention:

|       | Result                                                             |
| ----- | ------------------------------------------------------------------ |
| macOS | `⇧⌘Z` — drops the `+` and runs modifiers together in Apple's order |
| other | `Ctrl+Shift+Z` — spells them out in the Windows order              |

`bindingKeyLabel` renders the key half: `KeyZ` → `Z`, `BracketLeft` → `[`,
`BracketRight` → `]`, and named keys via `NAMED_KEY_LABELS` (arrows as glyphs
`←→↑↓`, `Backspace` → `⌫`, `Escape` → `Esc`).

`formatHint` is a **plain concatenation** with `" · "`. That is correct in both
directions: bidi keeps the Latin chord as one left-to-right run, so an Arabic
label still reads first.

**The native stub returns `NO_SHORTCUT_HINTS`, not the web chords.** A hint that
names a key the platform cannot deliver would be a lie in the tooltip.

`HINTS` is built once at module scope, because chords never change during a
session. Mac detection is `/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)`,
defaulting to `false` when `navigator` is undefined.

## 9. Modifier tracking is a module-level flag

`modifier-keys.web.ts` deliberately does **not** use React state:

- The gesture layer asks the question **at pointer-down, from inside a gesture
  callback that is not a render**, so the answer has to be readable imperatively.
- A hook's return value would be a **frame behind** and would **re-render the
  editor on every modifier keypress.**

Same reasoning that keeps the gesture scratch in the store rather than in refs.

`additive = shiftKey || metaKey || ctrlKey`, set on **both `keydown` and
`keyup`**, and cleared on **`blur`** and **`visibilitychange`**.

**`keyup` alone is not enough:** a modifier released while the window is not
focused (cmd-tab, a browser menu, a system dialog) never delivers one, and a stuck
`true` would quietly turn every later click into "add to the selection". Cleanup
clears it too.

This is what lets the desktop idioms work (Shift-click to add, Cmd/Ctrl-click to
toggle) while touch keeps the multi-select tool — which is still what the tool
rail advertises.

## 10. The executable spec

`scripts/check-shortcuts.mjs` is the real specification. There is no test runner
in this repo, so the script transpiles `shortcuts.ts` in memory with the installed
TypeScript and evaluates it standalone.

It asserts, in order:

1. **`shortcuts.ts` declares no imports** (source regex).
2. **Coverage** — every one of the 21 expected ids has at least one binding, no
   binding names an unknown action, and only `delete` and `redo` carry an
   alternate.
3. **Conflicts** — no two bindings share one keystroke signature
   (`key|code | mod|plain | shift`), because the matcher returns the first hit and
   a duplicate would leave the later one dead.
4. **Shadowing** — no `shift: "any"` binding swallows every Shift variant of a
   key that a later binding wants.
5. **~30 resolution assertions** — each documented binding resolves to its id,
   including `Ctrl+Z` vs `Ctrl+Shift+Z` deliberately being _different actions_.
6. **Non-matches** — a bare letter does not undo, `Ctrl+Shift+V` belongs to no
   binding, **AltGr (Ctrl+Alt) is left to the layout**, an in-flight composition
   owns the key, and an unknown key is ignored.
7. **Auto-repeat** — a held arrow keeps nudging; a held `Ctrl+Z` does not repeat.
8. **Layout independence** — `{ code: "KeyV", key: "ر" }` still selects.
9. **Chord text** — `⌘Z`, `Ctrl+Z`, `⇧⌘Z`, `Ctrl+Shift+Z`, `Delete`, `V`, `⌘]`,
   `←`, `⇧H`, `Shift+H`; `formatHint` with and without a chord; every action has a
   chord; `NO_SHORTCUT_HINTS` adds nothing.
10. **Constants** — `NUDGE_STEP = 1`, `NUDGE_STEP_LARGE = 10`,
    `0 < NUDGE_COALESCE_MS < 500`.

**Run `node scripts/check-shortcuts.mjs` after touching `shortcuts.ts`.** It exits
non-zero on failure. Add a case whenever you add a binding — the matcher is the
part worth pinning down, because a wrong binding is silent and modifier mixes are
exactly where "redo" quietly becomes "undo".

## 11. Code map

| Concern                                                                            | File                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------ |
| `ShortcutId`, `SHORTCUT_BINDINGS`, nudge constants                                 | `src/editor/shortcuts.ts`                  |
| `matchShortcut`, `ShortcutKeyEvent`                                                | `src/editor/shortcuts.ts`                  |
| `formatChord`, `chordFor`, `formatHint`, `buildShortcutHints`, `NO_SHORTCUT_HINTS` | `src/editor/shortcuts.ts`                  |
| The web `document` listener, `isTypingTarget`, mac detection                       | `src/editor/use-keyboard-shortcuts.web.ts` |
| The inert native stub                                                              | `src/editor/use-keyboard-shortcuts.ts`     |
| Shift/Cmd/Ctrl module-level flag, `useModifierKeys`                                | `src/editor/modifier-keys.web.ts`          |
| Native `isAdditiveSelectionModifier() === false`                                   | `src/editor/modifier-keys.ts`              |
| Consuming the modifier at pointer-down                                             | `src/editor/use-object-gestures.ts`        |
| Handler wiring, `enabled` while a sheet is open                                    | `src/editor/EditorScreen.tsx`              |
| Executable spec                                                                    | `scripts/check-shortcuts.mjs`              |
