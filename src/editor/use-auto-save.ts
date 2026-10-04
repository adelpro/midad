import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useEditorStore } from '@/editor/store';
import { saveWithHistory } from '@/editor/save-with-history';
import { AUTO_SAVE_DEBOUNCE_MS, useSettings } from '@/storage/settings';

/**
 * True while a canvas gesture owns the document — a drag, a resize or a
 * rotation.
 *
 * Writing is a full `JSON.stringify` of the project plus a synchronous file
 * write, so a flush that lands mid-gesture stalls the very frame the finger is
 * in. The debounce timer can never be the culprit (every drag frame resets it),
 * but the periodic interval can and does.
 *
 * Read from `getState()` rather than subscribed: this is called from a timer,
 * not from render, and subscribing would re-render the host for scratch state
 * that is not rendered.
 */
function gestureInFlight(): boolean {
  const { gs } = useEditorStore.getState();
  return (
    gs.resizeTargetId !== null ||
    gs.transformTargetId !== null ||
    gs.collectionOrigins.length > 0 ||
    gs.dragOrigins.length > 0
  );
}

/**
 * Persists the JSON project after a quiet edit period and periodically while
 * the document is being edited. The periodic flush matters during a long
 * drag, where every frame keeps resetting the quiet-period timer.
 */
export function useAutoSave() {
  const enabled = useSettings((s) => s.autoSaveEnabled);
  const intervalMs = useSettings((s) => s.autoSaveIntervalMs);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest =
    useRef<ReturnType<typeof useEditorStore.getState>['project']>(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const pending = useRef(false);

  const flush = useCallback(async () => {
    if (!enabled) {
      return;
    }
    if (saving.current) {
      pending.current = true;
      return;
    }
    do {
      if (!dirty.current || !latest.current) {
        break;
      }
      saving.current = true;
      dirty.current = false;
      pending.current = false;
      try {
        await saveWithHistory();
      } catch {
        dirty.current = true;
      } finally {
        saving.current = false;
      }
    } while (pending.current);
  }, [enabled]);

  useEffect(() => {
    latest.current = useEditorStore.getState().project;
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.project === previous.project) {
        return;
      }
      latest.current = state.project;
      dirty.current = true;
      if (!enabled) {
        return;
      }
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        void flush();
      }, AUTO_SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [enabled, flush]);

  useEffect(() => {
    if (!enabled) {
      dirty.current = false;
      return;
    }
    const interval = setInterval(() => {
      // A gesture owns the document right now, so a write here would stall one
      // of its frames. Nothing is lost by waiting: the gesture's own frames keep
      // re-arming the debounce timer, which fires once the drag has settled.
      if (gestureInFlight()) {
        return;
      }
      void flush();
    }, intervalMs);

    const flushOnBackground = () => {
      // Deliberately NOT gesture-guarded: the user is leaving the app, and the
      // gesture in flight is being cancelled anyway. Stalling a frame that is
      // about to be frozen beats losing the edit.
      if (AppState.currentState !== 'active') {
        void flush();
      }
    };
    const subscription = AppState.addEventListener('change', flushOnBackground);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
          void flush();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        clearInterval(interval);
        subscription.remove();
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, intervalMs, flush]);
}
