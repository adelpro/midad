/**
 * Keyboard-shortcut definitions for the editor.
 *
 * Deliberately free of any React Native or DOM import: the web-only keydown
 * hook (`use-keyboard-shortcuts.web.ts`), the native stub, and
 * `scripts/check-shortcuts.mjs` all read this module, and the check script
 * transpiles it standalone. The DOM listener itself lives in the `.web` file so
 * no DOM type can ever be evaluated in a native bundle.
 *
 * The binding table below is the single source of truth: it drives both key
 * matching and the chord text shown in tooltips, so a rebind cannot leave a
 * stale hint behind.
 */

/** Every editor action reachable from the keyboard. */
export type ShortcutId =
  | 'delete'
  | 'undo'
  | 'redo'
  | 'duplicate'
  | 'selectAll'
  | 'save'
  | 'clearSelection'
  | 'nudgeLeft'
  | 'nudgeRight'
  | 'nudgeUp'
  | 'nudgeDown'
  | 'flipH'
  | 'flipV'
  | 'rotateCcw'
  | 'rotateCw'
  | 'bringToFront'
  | 'sendToBack'
  | 'group'
  | 'ungroup'
  | 'toolSelect'
  | 'toolMultiSelect'
  | 'toolText'
  | 'toggleGrid'
  | 'openHelp';

/** Nudge distance in design units. Shift moves ten times as far. */
export const NUDGE_STEP = 1;
export const NUDGE_STEP_LARGE = 10;

/**
 * Holding an arrow key auto-repeats at roughly 30 presses per second. Without
 * coalescing, one held key would flush the whole 50-entry undo stack of useful
 * history. A burst of nudges therefore shares a single snapshot, opened by the
 * first press and closed once the keys rest for this long.
 */
export const NUDGE_COALESCE_MS = 400;

/** `true` requires Shift, `false`/absent require it released, `"any"` allows both. */
type ShiftRequirement = boolean | 'any';

export interface ShortcutBinding {
  id: ShortcutId;
  /** `event.key` to match. Layout-dependent, so only used for named keys. */
  key?: string;
  /** `event.code` to match. Layout-independent — the right choice for letters. */
  code?: string;
  /**
   * Requires the platform modifier. Accepts either Meta or Ctrl so the same
   * table works on macOS and elsewhere; the chord text is what distinguishes
   * them to the user.
   */
  mod?: boolean;
  shift?: ShiftRequirement;
  /**
   * Auto-repeat is harmless while moving a selection and harmful for one-shot
   * commands, which would otherwise fire dozens of times as a key is held.
   */
  repeat?: boolean;
}

/**
 * Bindings are matched in order, first hit wins. Every signature is unique, so
 * order only matters for readability — `scripts/check-shortcuts.mjs` enforces
 * that, and that the shift variants are declared ahead of their plain siblings.
 *
 * Letters are declared by `code` rather than `key` because `key` reports the
 * character the active layout produces: on an Arabic layout the physical V key
 * yields "ر", which would leave every letter shortcut dead. `code` names the
 * physical key instead, so the bindings work on any layout.
 */
export const SHORTCUT_BINDINGS: readonly ShortcutBinding[] = [
  // Delete is the labelled key on full keyboards and Backspace on laptop ones;
  // both are expected to remove the selection.
  { id: 'delete', key: 'Delete' },
  { id: 'delete', key: 'Backspace' },

  { id: 'undo', code: 'KeyZ', mod: true },
  { id: 'redo', code: 'KeyZ', mod: true, shift: true },
  // Ctrl+Y is the Windows habit for redo; it is not advertised in the tooltip.
  { id: 'redo', code: 'KeyY', mod: true },

  { id: 'duplicate', code: 'KeyD', mod: true },
  { id: 'selectAll', code: 'KeyA', mod: true },
  { id: 'save', code: 'KeyS', mod: true },

  // Sheets close on Escape through react-native-web's own Modal listener, so
  // this binding only ever runs while no sheet is open.
  { id: 'clearSelection', key: 'Escape' },

  { id: 'nudgeLeft', key: 'ArrowLeft', shift: 'any', repeat: true },
  { id: 'nudgeRight', key: 'ArrowRight', shift: 'any', repeat: true },
  { id: 'nudgeUp', key: 'ArrowUp', shift: 'any', repeat: true },
  { id: 'nudgeDown', key: 'ArrowDown', shift: 'any', repeat: true },

  { id: 'flipH', code: 'KeyH', shift: true },
  { id: 'flipV', code: 'KeyV', shift: true },
  { id: 'rotateCcw', code: 'KeyE', shift: true },
  { id: 'rotateCw', code: 'KeyR', shift: true },

  { id: 'bringToFront', code: 'BracketRight', mod: true },
  { id: 'sendToBack', code: 'BracketLeft', mod: true },

  // Grouping: the modified chord joins the selection into one element, the
  // shifted one dissolves it again. Declared shifted-first, like every other
  // pair in this table.
  { id: 'ungroup', code: 'KeyG', mod: true, shift: true },
  { id: 'group', code: 'KeyG', mod: true },

  { id: 'toolSelect', code: 'KeyV' },
  { id: 'toolMultiSelect', code: 'KeyM' },
  { id: 'toolText', code: 'KeyT' },
  { id: 'toggleGrid', code: 'KeyG' },

  // Shift+/ is the question mark on every layout — "?" on Latin, "؟" on
  // Arabic — so it is bound by physical key rather than by character.
  { id: 'openHelp', code: 'Slash', shift: true },
];

/** The slice of `KeyboardEvent` the matcher reads. Keeps this module testable. */
export interface ShortcutKeyEvent {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
  isComposing?: boolean;
}

/**
 * Resolves a key event to its binding, or null when nothing claims the key.
 *
 * Returns the binding rather than the action so the caller can read the
 * modifiers it declared — the nudge bindings accept Shift either way and rely
 * on the press context to pick a distance.
 */
export function matchShortcut(event: ShortcutKeyEvent): ShortcutBinding | null {
  // An in-flight IME composition owns the keystroke; stealing it would break
  // composition-based input.
  if (event.isComposing) {
    return null;
  }
  // AltGr reports as Ctrl+Alt on several Windows layouts. Requiring Alt to be
  // released keeps the characters those layouts produce out of the way.
  if (event.altKey) {
    return null;
  }
  for (const binding of SHORTCUT_BINDINGS) {
    if (binding.key === undefined && binding.code === undefined) {
      continue;
    }
    if (binding.key !== undefined && binding.key !== event.key) {
      continue;
    }
    if (binding.code !== undefined && binding.code !== event.code) {
      continue;
    }
    // An undeclared modifier must be released, or Ctrl+Shift+Z would also be
    // read as Ctrl+Z and redo would undo first.
    const mod = event.metaKey || event.ctrlKey;
    if (!!binding.mod !== mod) {
      continue;
    }
    if (binding.shift !== 'any' && !!binding.shift !== event.shiftKey) {
      continue;
    }
    if (event.repeat && !binding.repeat) {
      continue;
    }
    return binding;
  }
  return null;
}

/** Per-press context handed to a handler, for the bindings that need it. */
export interface ShortcutContext {
  shift: boolean;
  repeat: boolean;
}

/** Callbacks the shortcut layer can invoke, keyed by action. */
export type EditorShortcutHandlers = Partial<
  Record<ShortcutId, (context: ShortcutContext) => void>
>;

/** What `EditorScreen` passes to the platform hook. */
export interface EditorShortcutsOptions {
  /** False while a sheet is open, so typing never doubles as a command. */
  enabled: boolean;
  handlers: EditorShortcutHandlers;
}

/** Chord text for the tooltip affordances. */
export interface EditorShortcutHints {
  /** The chord for one action, e.g. "⇧⌘Z". Empty when the platform has none. */
  chord: (id: ShortcutId) => string;
  /** `label` with its chord appended, or `label` alone when there is none. */
  hint: (label: string, id: ShortcutId) => string;
}

/** Key names that read better as symbols than as words. */
const NAMED_KEY_LABELS: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Delete: 'Delete',
  Backspace: '⌫',
  Escape: 'Esc',
};

/** `KeyZ` → "Z", `BracketRight` → "]", anything else left as-is. */
function codeLabel(code: string): string {
  if (code.startsWith('Key')) {
    return code.slice('Key'.length);
  }
  if (code === 'BracketLeft') {
    return '[';
  }
  if (code === 'BracketRight') {
    return ']';
  }
  if (code === 'Slash') {
    return '?';
  }
  return code;
}

function keyLabel(key: string): string {
  return NAMED_KEY_LABELS[key] ?? key;
}

/** The key half of a chord, without modifiers. */
function bindingKeyLabel(binding: ShortcutBinding): string {
  if (binding.code !== undefined) {
    return codeLabel(binding.code);
  }
  return keyLabel(binding.key ?? '');
}

/**
 * Renders one binding as keycap text.
 *
 * macOS drops the "+" and runs the modifiers together in the order Apple's
 * guidelines use (⇧⌘Z); other platforms spell them out in the Windows order
 * (Ctrl+Shift+Z).
 */
export function formatChord(binding: ShortcutBinding, isMac: boolean): string {
  const key = bindingKeyLabel(binding);
  if (!binding.mod && binding.shift !== true) {
    return key;
  }
  if (isMac) {
    const shift = binding.shift === true ? '⇧' : '';
    const mod = binding.mod ? '⌘' : '';
    return `${shift}${mod}${key}`;
  }
  const parts: string[] = [];
  if (binding.mod) {
    parts.push('Ctrl');
  }
  if (binding.shift === true) {
    parts.push('Shift');
  }
  return [...parts, key].join('+');
}

/** The chord advertised for an action — its first declared binding. */
export function chordFor(id: ShortcutId, isMac: boolean): string {
  const binding = SHORTCUT_BINDINGS.find((b) => b.id === id);
  return binding ? formatChord(binding, isMac) : '';
}

/**
 * Joins a label and its chord for display in a tooltip.
 *
 * A plain concatenation is correct in both directions: bidi keeps the Latin
 * chord as one left-to-right run, so an Arabic label still reads first.
 */
export function formatHint(label: string, chord: string): string {
  return chord ? `${label} · ${chord}` : label;
}

/** The hint surface a platform with keyboard support exposes. */
export function buildShortcutHints(isMac: boolean): EditorShortcutHints {
  return {
    chord: (id) => chordFor(id, isMac),
    hint: (label, id) => formatHint(label, chordFor(id, isMac)),
  };
}

/**
 * The hint surface where there are no shortcuts to advertise. The native stub
 * returns this so native tooltips never promise a key that cannot be pressed.
 */
export const NO_SHORTCUT_HINTS: EditorShortcutHints = {
  chord: () => '',
  hint: (label) => label,
};
