import { useEffect } from 'react';

/**
 * Shift / Cmd / Ctrl, tracked as a live flag rather than as React state.
 *
 * The gesture layer asks the question *at pointer-down*, from inside a gesture
 * callback that is not a render, so the answer has to be readable imperatively.
 * A hook's return value would be a frame behind and would re-render the editor
 * on every modifier keypress. Same reasoning that keeps the editor's gesture
 * scratch in the store rather than in refs.
 *
 * This is what lets the desktop idioms work (Shift-click to add, Cmd/Ctrl-click
 * to toggle) while touch keeps the multi-select tool, which is still what the
 * tool rail advertises.
 */

/** Whether a selection modifier was held when we last saw a key event. */
let additive = false;

function read(event: KeyboardEvent): boolean {
  return event.shiftKey || event.metaKey || event.ctrlKey;
}

/** True while Shift, Cmd or Ctrl is held. */
export function isAdditiveSelectionModifier(): boolean {
  return additive;
}

/**
 * Tracks the modifiers for the life of the screen.
 *
 * `keyup` alone is not enough: a modifier released while the window is not
 * focused (cmd-tab, a browser menu, a system dialog) never delivers one, and a
 * stuck `true` would quietly turn every later click into "add to the
 * selection". Blur and tab-hide both clear it.
 */
export function useModifierKeys(): void {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      additive = read(event);
    };
    const clear = () => {
      additive = false;
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      clear();
    };
  }, []);
}
