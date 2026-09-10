import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Book } from '@/lib/types';
import { clearBookAllData, BookContentStorage } from '@/lib/storage/idb-storage';
import { useHighlightStore } from './highlight-store';
import { useVocabStore } from './vocab-store';

interface LibraryState {
  books: Book[];
  currentBookId: string | null;
  _hasHydrated: boolean;
  addBook: (book: Book) => void;
  removeBook: (id: string) => Promise<void>;
  updateBook: (id: string, updates: Partial<Book>) => void;
  setCurrentBook: (id: string | null) => void;
  getCurrentBook: () => Book | null;
  getBookWithContent: (id: string) => Promise<Book | null>;
  refresh: () => void;
  updateBookTranslations: (id: string, translations: Record<number, string>, status: Book['translationStatus']) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      books: [],
      currentBookId: null,
      _hasHydrated: false,

      addBook: (book) => {
        set((state) => ({
          books: [...state.books, book],
          currentBookId: book.id,
        }));
      },

      removeBook: async (id) => {
        await clearBookAllData(id).catch(console.error);
        useHighlightStore.getState().clearBookHighlights?.(id);
        useVocabStore.getState().clearBookVocabs?.(id);

        set((state) => ({
          books: state.books.filter((b) => b.id !== id),
          currentBookId: state.currentBookId === id ? null : state.currentBookId,
        }));
      },

      updateBook: (id, updates) => {
        set((state) => ({
          books: state.books.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        }));
      },

      updateBookTranslations: (id, translations, status) => {
        set((state) => ({
          books: state.books.map((b) =>
            b.id === id ? { ...b, translations, translationStatus: status } : b
          ),
        }));
      },

      setCurrentBook: (id) => set({ currentBookId: id }),

      getCurrentBook: () => {
        const state = get();
        return state.books.find((b) => b.id === state.currentBookId) || null;
      },

      getBookWithContent: async (id: string): Promise<Book | null> => {
        const state = get();
        const bookMeta = state.books.find((b) => b.id === id);
        if (!bookMeta) return null;

        // If content already in memory, return as-is
        if (bookMeta.content) return bookMeta;

        // Load full content from IndexedDB
        const contentData = await BookContentStorage.get(id);
        if (!contentData) return bookMeta;

        return {
          ...bookMeta,
          content: contentData.content,
          chapters: contentData.chapters || bookMeta.chapters,
        };
      },

      refresh: () => {
        // No-op for compatibility
      },

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'zen-reader-library',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        books: state.books,
        currentBookId: state.currentBookId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
