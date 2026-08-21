import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Language } from '@/i18n/strings';

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
  setLanguage: (lang: Language) => void;
  setDefaultCanvas: (index: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ar',
      defaultCanvasIndex: 0,
      setLanguage: (language) => set({ language }),
      setDefaultCanvas: (defaultCanvasIndex) => set({ defaultCanvasIndex }),
    }),
    {
      name: 'midad:settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);