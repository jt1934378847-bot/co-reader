import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ThemeMode {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  lineHeight: number;
  readingWidth: number;
  apiConfig: APIConfig | null;
  customWallpaper: string | null;
  wallpaperOpacity: number;
  wallpaperBlur: number;
}

interface APIConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'moonshot' | 'custom';
  apiKey: string;
  baseURL: string;
  model: string;
}

interface SettingsState extends ThemeMode {
  _hasHydrated: boolean;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setReadingWidth: (width: number) => void;
  setApiConfig: (config: APIConfig | null) => void;
  clearApiConfig: () => void;
  setCustomWallpaper: (wallpaper: string | null) => void;
  setWallpaperOpacity: (opacity: number) => void;
  setWallpaperBlur: (blur: number) => void;
  clearCustomWallpaper: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 18,
      lineHeight: 1.8,
      readingWidth: 680,
      apiConfig: null,
      customWallpaper: null,
      wallpaperOpacity: 15,
      wallpaperBlur: 0,
      _hasHydrated: false,

      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setReadingWidth: (readingWidth) => set({ readingWidth }),
      setApiConfig: (apiConfig) => set({ apiConfig }),
      clearApiConfig: () => set({ apiConfig: null }),
      setCustomWallpaper: (customWallpaper) => set({ customWallpaper }),
      setWallpaperOpacity: (wallpaperOpacity) => set({ wallpaperOpacity }),
      setWallpaperBlur: (wallpaperBlur) => set({ wallpaperBlur }),
      clearCustomWallpaper: () => set({ customWallpaper: null, wallpaperOpacity: 15, wallpaperBlur: 0 }),
      setHasHydrated: (state) => set({ _hasHydrated: state })
    }),
    {
      name: 'zen-reader-settings',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
