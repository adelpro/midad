import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { setPinnedId, togglePinnedId } from '@/theme/font-pins';

/**
 * Pinned font families — a **device-local** preference, deliberately not part of
 * `MidadProject`.
 *
 * Pinning is about how *this* device presents the font picker, not about the
 * artwork, so it must not leak into the project document: keeping it out means
 * no schema bump and nothing new for `import-project.ts` to validate. The cost is
 * that a pin does not travel with an exported `.midad` file — the same trade
 * `src/storage/pins.ts` makes for the gallery.
 *
 * Ids are `FontPinId`s (`src/theme/font-pins.ts`): `family:<familyKey>` for a
 * bundled family, `google:<fontId>` for a remote one. There is no pruning: a
 * pinned remote id that leaves the catalogue is still renderable by name, and
 * pruning against an offline catalogue would delete a real pin.
 *
 * Same persistence shape as `src/storage/pins.ts`.
 */
interface FontPinsState {
  /** Most-recently pinned first. */
  pinnedIds: string[];
  /**
   * Whether the picker's Pinned section is collapsed. Persisted like the pins
   * themselves, so the choice survives a restart.
   */
  pinnedCollapsed: boolean;
  toggleFontPin: (id: string) => void;
  setFontPinned: (id: string, pinned: boolean) => void;
  unpinFont: (id: string) => void;
  setPinnedCollapsed: (collapsed: boolean) => void;
}

export const useFontPins = create<FontPinsState>()(
  persist(
    (set) => ({
      pinnedIds: [],
      pinnedCollapsed: false,
      toggleFontPin: (id) =>
        set((s) => ({ pinnedIds: togglePinnedId(s.pinnedIds, id) })),
      setFontPinned: (id, pinned) =>
        set((s) => {
          const next = setPinnedId(s.pinnedIds, id, pinned);
          return next ? { pinnedIds: next } : s;
        }),
      unpinFont: (id) =>
        set((s) => {
          const next = setPinnedId(s.pinnedIds, id, false);
          return next ? { pinnedIds: next } : s;
        }),
      setPinnedCollapsed: (pinnedCollapsed) => set({ pinnedCollapsed }),
    }),
    {
      name: 'midad:font-pins',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
