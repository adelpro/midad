import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SelectionActionId } from '@/editor/selection-actions';
import type { Language } from '@/i18n/strings';
import { pushRecent } from '@/theme/color';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Preset auto-save flush intervals, in milliseconds. */
export const AUTO_SAVE_INTERVALS_MS = [
  10_000, 30_000, 60_000, 300_000,
] as const;

export const AUTO_SAVE_INTERVAL_DEFAULT_MS = 30_000;

/** Quiet period after the last edit before an auto-save is written. */
export const AUTO_SAVE_DEBOUNCE_MS = 1_000;

/** How many custom colours the picker remembers before dropping the oldest. */
export const RECENT_COLORS_MAX = 8;

export interface CanvasSize {
  labelAr: string;
  labelEn: string;
  width: number; // design units
  height: number;
}

export const DEFAULT_CANVASES: CanvasSize[] = [
  { labelAr: 'مربع', labelEn: 'Square', width: 1080, height: 1080 },
  { labelAr: 'عمودي', labelEn: 'Portrait', width: 1080, height: 1620 },
  { labelAr: 'أفقي', labelEn: 'Landscape', width: 1620, height: 1080 },
  { labelAr: 'بطاقة', labelEn: 'Card', width: 1080, height: 720 },
];

interface SettingsState {
  language: Language;
  defaultCanvasIndex: number;
  theme: ThemePreference;
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
  /**
   * The selection bar's actions, in the order the rail renders them — or `null`
   * while the user has never changed it.
   *
   * `null` rather than a seeded copy of the default order on purpose: the table
   * in `src/editor/selection-actions.tsx` stays the one place that decides what
   * a fresh bar holds, so a reordering there reaches everyone who never
   * customised the bar, while anyone who did keeps exactly the bar they built.
   *
   * A device-local preference, like the gallery's pins: it describes how this
   * device presents the editor, so it never enters the project document (no
   * schema bump, nothing for `import-project.ts` to validate). The cost is that
   * a customised bar does not travel with an exported `.midad` file — which is
   * the intended trade.
   */
  selectionBarActions: SelectionActionId[] | null;
  /**
   * Custom colours entered in the picker, most recent first — device-local like
   * `selectionBarActions`, so it never enters the project document.
   */
  recentColors: string[];
  /**
   * Whether the intro has been completed (or skipped) at least once on this
   * device — `false` on a fresh install, so the first launch lands on the
   * onboarding route.
   *
   * Re-opening it from Settings deliberately does NOT clear this: the intro is
   * a replay, not a reset, so it never returns on its own.
   *
   * Device-local like `selectionBarActions` — how this device introduces the
   * app, not part of the design, so it stays out of the project document.
   */
  hasCompletedOnboarding: boolean;
  setLanguage: (lang: Language) => void;
  setDefaultCanvas: (index: number) => void;
  setTheme: (theme: ThemePreference) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setAutoSaveInterval: (ms: number) => void;
  setSelectionBarActions: (ids: SelectionActionId[] | null) => void;
  /** Remember a custom colour, most recent first, deduped and capped. */
  pushRecentColor: (color: string) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ar',
      defaultCanvasIndex: 0,
      theme: 'system',
      autoSaveEnabled: true,
      autoSaveIntervalMs: AUTO_SAVE_INTERVAL_DEFAULT_MS,
      selectionBarActions: null,
      recentColors: [],
      hasCompletedOnboarding: false,
      setLanguage: (language) => set({ language }),
      setDefaultCanvas: (defaultCanvasIndex) => set({ defaultCanvasIndex }),
      setTheme: (theme) => set({ theme }),
      setAutoSaveEnabled: (autoSaveEnabled) => set({ autoSaveEnabled }),
      setAutoSaveInterval: (autoSaveIntervalMs) => set({ autoSaveIntervalMs }),
      setSelectionBarActions: (selectionBarActions) =>
        set({ selectionBarActions }),
      pushRecentColor: (color) =>
        set((state) => ({
          recentColors: pushRecent(state.recentColors, color, RECENT_COLORS_MAX),
        })),
      setHasCompletedOnboarding: (hasCompletedOnboarding) =>
        set({ hasCompletedOnboarding }),
    }),
    {
      name: 'midad:settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
