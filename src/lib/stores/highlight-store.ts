import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Highlight {
  id: string;
  bookId: string;
  chapterIndex: number;
  text: string;
  note?: string;
  color: string;
  createdAt: Date;
}

interface HighlightState {
  highlights: Highlight[];
  _hasHydrated: boolean;
  addHighlight: (highlight: Omit<Highlight, 'id' | 'createdAt'>) => void;
  updateHighlightNote: (id: string, note: string) => void;
  removeHighlight: (id: string) => void;
  getBookHighlights: (bookId: string) => Highlight[];
  clearBookHighlights: (bookId: string) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useHighlightStore = create<HighlightState>()(
  persist(
    (set, get) => ({
      highlights: [],
      _hasHydrated: false,

      addHighlight: (highlight) => set((state) => ({
        highlights: [...state.highlights, {
          ...highlight,
          id: `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          createdAt: new Date()
        }]
      })),

      updateHighlightNote: (id, note) => set((state) => ({
        highlights: state.highlights.map((h) =>
          h.id === id ? { ...h, note } : h
        )
      })),

      removeHighlight: (id) => set((state) => ({
        highlights: state.highlights.filter((h) => h.id !== id)
      })),

      getBookHighlights: (bookId) => {
        return get().highlights.filter((h) => h.bookId === bookId);
      },

      clearBookHighlights: (bookId) => set((state) => ({
        highlights: state.highlights.filter((h) => h.bookId !== bookId)
      })),

      setHasHydrated: (state) => set({ _hasHydrated: state })
    }),
    {
      name: 'zen-reader-highlights',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
