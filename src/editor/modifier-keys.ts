/**
 * Selection modifiers, on a platform that has none.
 *
 * Touch has no Shift/Cmd/Ctrl to hold, so nothing here can ever widen a
 * selection: on native the multi-select tool is what stands in for the missing
 * modifier. The getter and the hook exist so the gesture layer can ask the one
 * question on every platform instead of branching on `Platform.OS` — Metro
 * swaps in `modifier-keys.web.ts` on web.
 */

/** False on native — the multi-select tool is the modifier here. */
export function isAdditiveSelectionModifier(): boolean {
  return false;
}

/** Nothing to track without a hardware keyboard. */
export function useModifierKeys(): void {}
