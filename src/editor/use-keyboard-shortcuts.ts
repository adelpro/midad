import {
  NO_SHORTCUT_HINTS,
  type EditorShortcutHints,
  type EditorShortcutsOptions,
} from '@/editor/shortcuts';

/**
 * Native implementation: inert.
 *
 * React Native exposes no `keydown` for a hardware keyboard, so there is
 * nothing to listen for here. This file exists so `EditorScreen` can call one
 * platform-agnostic hook — Metro resolves the `.web` sibling on web and this
 * one everywhere else.
 *
 * It returns blank chords rather than the web ones: a hint that names a key the
 * platform cannot deliver would be a lie in the tooltip.
 */
export function useKeyboardShortcuts(
  options: EditorShortcutsOptions,
): EditorShortcutHints {
  // `void` keeps the shared call signature honest without pretending to use it.
  void options;
  return NO_SHORTCUT_HINTS;
}
