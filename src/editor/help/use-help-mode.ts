import { useCallback, useState } from "react";

import { hapticTick } from "@/haptics";

import type { HelpKey } from "./catalog";

export interface HelpMode {
  /** Whether learn mode is on. */
  active: boolean;
  /** The control inspected last, for the banner. Null before the first tap. */
  activeKey: HelpKey | null;
  /** Flip the mode on or off and clear the current explanation. */
  toggle: () => void;
  /** Leave the mode. */
  exit: () => void;
  /**
   * Binds one control to its help entry.
   *
   * While learn mode is on the returned handler *replaces* the action rather
   * than wrapping it: a press explains the control and changes nothing. That is
   * the whole point of the mode — a user tapping "delete" to find out what it
   * does must not lose their work — so this is deliberately not a "show a hint
   * and also fire" decorator.
   *
   * Off-mode it is a plain pass-through, so a call site reads the same either
   * way: `onPress={help.press("sel.delete", deleteSelected)}`.
   */
  press: (key: HelpKey, action?: () => void) => () => void;
}

/**
 * Learn mode: a state where every editor control explains itself on tap
 * instead of acting.
 *
 * State lives in the editor screen rather than in a store or a context. Every
 * control it annotates — including the buttons inside the three editor sheets —
 * is rendered by `EditorScreen` itself, so there is no tree boundary to cross
 * and nothing to provide. That also keeps the mode's blast radius to the editor
 * screen, which is the whole of its scope.
 */
export function useHelpMode(): HelpMode {
  const [active, setActive] = useState(false);
  const [activeKey, setActiveKey] = useState<HelpKey | null>(null);

  const toggle = useCallback(() => {
    hapticTick();
    // Safe unconditionally: entering starts with nothing explained, and leaving
    // should not remember one.
    setActiveKey(null);
    setActive((on) => !on);
  }, []);

  const exit = useCallback(() => {
    setActiveKey(null);
    setActive(false);
  }, []);

  const press = useCallback(
    (key: HelpKey, action?: () => void) =>
      active
        ? () => {
            hapticTick();
            setActiveKey(key);
          }
        : () => action?.(),
    [active],
  );

  return { active, activeKey, toggle, exit, press };
}
