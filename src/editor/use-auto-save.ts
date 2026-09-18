import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useEditorStore } from '@/editor/store';
import { saveProject } from '@/storage/projects';
import { AUTO_SAVE_DEBOUNCE_MS, useSettings } from '@/storage/settings';

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
        await saveProject({
          ...latest.current,
          updatedAt: new Date().toISOString(),
        });
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
      void flush();
    }, intervalMs);

    const flushOnBackground = () => {
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
