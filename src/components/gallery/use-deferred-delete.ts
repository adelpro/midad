import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/i18n";
import { formatDeletedNotice } from "@/i18n/strings";
import { usePins } from "@/storage/pins";
import type { MidadProject } from "@/storage/project-schema";
import { deleteProject } from "@/storage/projects";
import { deleteThumb } from "@/storage/thumbs";

/** The user-visible undo contract. */
export const UNDO_WINDOW_MS = 5_000;

export interface DeferredDelete {
  /** Project inside its undo window, or null. Drives the snackbar. */
  pending: MidadProject | null;
  /** Localized snackbar copy for `pending`. */
  notice: string;
  /** Remove a project optimistically and open its undo window. */
  requestDelete: (project: MidadProject) => void;
  /** Put the project back. Nothing was written to disk, so this is free. */
  undo: () => void;
  /** Commit now without waiting out the window. */
  flush: () => void;
}

/**
 * Delete with an undo window, implemented as **deferred commit**.
 *
 * The files are left untouched while the snackbar is up; only the in-memory
 * list forgets the project. After `UNDO_WINDOW_MS` the real
 * `deleteProject`/`deleteThumb` calls run. Undo therefore costs nothing and
 * touches no disk.
 *
 * The obvious alternative — delete immediately, then re-write on undo — does
 * not work here: `getThumb()` hands back a *file URI* on native while
 * `saveThumb()` expects a *base64 data URI*, so restoring a thumbnail would
 * write a corrupted file.
 *
 * Trade-off: if the process dies inside the window the delete never happened
 * and the project reappears on next launch. That fails toward keeping the
 * user's work, which is the right direction.
 */
export function useDeferredDelete(onUndo: () => void): DeferredDelete {
  const { language } = useT();
  const [pending, setPending] = useState<MidadProject | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `pending` so timer callbacks and unmount cleanup read the latest
  // value without re-subscribing.
  const pendingRef = useRef<MidadProject | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const commit = useCallback(async (project: MidadProject) => {
    try {
      await deleteProject(project.id);
      await deleteThumb(project.id);
    } catch {
      // Best-effort: a failed delete must not strand the UI.
    }
    // Drop the pin so `pinnedIds` cannot accumulate dead ids.
    usePins.getState().unpin(project.id);
  }, []);

  const settle = useCallback(() => {
    const project = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    return project;
  }, []);

  const flush = useCallback(() => {
    clearTimer();
    const project = settle();
    if (project) {
      void commit(project);
    }
  }, [clearTimer, commit, settle]);

  const requestDelete = useCallback(
    (project: MidadProject) => {
      // Single slot: the previous pending delete is committed as the new one
      // takes over, so only one undo is ever on offer.
      const previous = pendingRef.current;
      if (previous && previous.id !== project.id) {
        void commit(previous);
      }
      clearTimer();
      pendingRef.current = project;
      setPending(project);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const due = pendingRef.current;
        pendingRef.current = null;
        setPending(null);
        if (due) {
          void commit(due);
        }
      }, UNDO_WINDOW_MS);
    },
    [clearTimer, commit],
  );

  const undo = useCallback(() => {
    if (pendingRef.current === null) {
      return;
    }
    clearTimer();
    pendingRef.current = null;
    setPending(null);
    onUndo();
  }, [clearTimer, onUndo]);

  // Unmount is the only path that would strand a pending delete, so settle it.
  // No state is written here — the component is going away regardless.
  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const project = pendingRef.current;
      pendingRef.current = null;
      if (project) {
        void commit(project);
      }
    },
    [commit],
  );

  return {
    pending,
    notice: pending ? formatDeletedNotice(pending.name, language) : "",
    requestDelete,
    undo,
    flush,
  };
}
