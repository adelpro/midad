import { useEffect, useRef } from "react";

import {
  buildShortcutHints,
  matchShortcut,
  type EditorShortcutHints,
  type EditorShortcutsOptions,
} from "@/editor/shortcuts";

/**
 * Web implementation: one `keydown` listener on the document.
 *
 * It has to live on the document rather than on the canvas element because the
 * canvas is a Skia surface with no focus of its own — a mouse user never
 * focuses it, and react-native-web's `Modal` portals sheets out of the editor's
 * subtree, so a subtree listener would miss keys while a sheet is open (which
 * is exactly when `enabled` turns the layer off).
 *
 * The equivalent long-press/gesture paths stay untouched; this only adds what a
 * physical keyboard can offer.
 */

/** True when macOS-style modifier glyphs are the ones the user's keys show. */
function detectMacPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * True when the keystroke belongs to a text field rather than the canvas.
 * Tooltips and labels are not form fields, so this only matches real inputs.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Chords never change during a session, so they are built once. */
const HINTS = buildShortcutHints(detectMacPlatform());

export function useKeyboardShortcuts(
  options: EditorShortcutsOptions,
): EditorShortcutHints {
  // The options object is rebuilt on every render, so it is held in a ref: the
  // listener attaches once for the life of the screen and always reads the
  // current handlers and `enabled` flag through here.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const current = optionsRef.current;
      // A sheet owns the keyboard while it is open, which is also what lets
      // react-native-web's own Escape handler close it unimpeded.
      if (!current.enabled) {
        return;
      }
      // Similarly, a focused text field owns every key: typing must never
      // double as a command.
      if (isTypingTarget(event.target)) {
        return;
      }
      // Something earlier in the document already handled this keystroke.
      if (event.defaultPrevented) {
        return;
      }
      const binding = matchShortcut(event);
      if (!binding) {
        return;
      }
      const run = current.handlers[binding.id];
      if (!run) {
        return;
      }
      // Claim the key before acting: every binding has a browser default worth
      // suppressing. Ctrl+S saves the page, Ctrl+D bookmarks it, Ctrl+A selects
      // it, and the arrows and Backspace scroll it or navigate away.
      event.preventDefault();
      run({ shift: event.shiftKey, repeat: event.repeat });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return HINTS;
}
