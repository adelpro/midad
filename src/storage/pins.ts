import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Pinned designs — a **device-local** preference, deliberately not part of
 * `MidadProject`.
 *
 * Pinning is about how *this* device presents the library, not about the
 * artwork, so it must not leak into the project document: keeping it out means
 * no schema bump, no migration, and nothing new for `import-project.ts` to
 * validate. The cost is that a pin does not travel with an exported `.midad`
 * file and is not shared across devices, which is the intended trade.
 *
 * Same persistence shape as `src/storage/settings.ts`.
 */
interface PinsState {
  /** Most-recently pinned first. Ids may briefly reference deleted projects. */
  pinnedIds: string[];
  togglePin: (id: string) => void;
  setPinned: (id: string, pinned: boolean) => void;
  unpin: (id: string) => void;
  /** Drop ids that no longer exist, so storage cannot grow without bound. */
  prunePins: (existingIds: readonly string[]) => void;
}

export const usePins = create<PinsState>()(
  persist(
    (set) => ({
      pinnedIds: [],
      togglePin: (id) =>
        set((s) => ({
          pinnedIds: s.pinnedIds.includes(id)
            ? s.pinnedIds.filter((x) => x !== id)
            : [id, ...s.pinnedIds],
        })),
      setPinned: (id, pinned) =>
        set((s) => {
          if (s.pinnedIds.includes(id) === pinned) {
            return s;
          }
          return {
            pinnedIds: pinned
              ? [id, ...s.pinnedIds]
              : s.pinnedIds.filter((x) => x !== id),
          };
        }),
      unpin: (id) =>
        set((s) =>
          s.pinnedIds.includes(id)
            ? { pinnedIds: s.pinnedIds.filter((x) => x !== id) }
            : s,
        ),
      prunePins: (existingIds) =>
        set((s) => {
          const keep = new Set(existingIds);
          const next = s.pinnedIds.filter((id) => keep.has(id));
          return next.length === s.pinnedIds.length ? s : { pinnedIds: next };
        }),
    }),
    {
      name: 'midad:pins',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Non-reactive read, for use inside async handlers. */
export function isPinned(id: string): boolean {
  return usePins.getState().pinnedIds.includes(id);
}

/**
 * Pinned designs first, then newest-first — matching the `updatedAt` ordering
 * both storage backends already apply in `listProjects()`, so the list does not
 * reshuffle just because a pin exists.
 *
 * Computed here rather than in storage because pins are device-local: the
 * project documents never carry the flag.
 */
export function sortPinnedFirst<T extends { id: string; updatedAt: string }>(
  projects: readonly T[],
  pinnedIds: readonly string[],
): T[] {
  if (pinnedIds.length === 0) {
    return [...projects];
  }
  const pinned = new Set(pinnedIds);
  return [...projects].sort((a, b) => {
    const aPinned = pinned.has(a.id);
    const bPinned = pinned.has(b.id);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
}
