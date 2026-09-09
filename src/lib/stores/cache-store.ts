import { create } from 'zustand';
import {
  TranslationCache,
  QACache,
  VocabCache,
  GrammarCache,
  getCacheStats,
  clearAllCaches,
  TranslationCacheEntry,
  QACacheEntry,
  VocabCacheEntry,
  GrammarCacheEntry,
} from '@/lib/storage/idb-storage';

interface CacheState {
  _hasHydrated: boolean;

  // Translation cache methods
  getTranslation: (bookId: string, chapterIndex: number, paragraphIndex: number, originalText: string) => Promise<string | null>;
  addTranslation: (entry: Omit<TranslationCacheEntry, 'id' | 'createdAt'>) => Promise<void>;
  clearBookTranslations: (bookId: string) => Promise<void>;
  clearAllTranslations: () => Promise<void>;

  // QA cache methods
  getQA: (bookId: string, question: string, context: string) => Promise<QACacheEntry | null>;
  addQA: (entry: Omit<QACacheEntry, 'id' | 'createdAt'>) => Promise<void>;
  clearBookQA: (bookId: string) => Promise<void>;
  clearAllQA: () => Promise<void>;

  // Vocab cache methods
  getVocab: (bookId: string, chapterIndex: number, paragraphIndex: number, textHash: string) => Promise<VocabCacheEntry['vocabulary'] | null>;
  addVocab: (entry: Omit<VocabCacheEntry, 'id' | 'createdAt'>) => Promise<void>;
  clearBookVocab: (bookId: string) => Promise<void>;

  // Grammar cache methods
  getGrammar: (bookId: string, chapterIndex: number, paragraphIndex: number, textHash: string) => Promise<GrammarCacheEntry['grammar'] | null>;
  addGrammar: (entry: Omit<GrammarCacheEntry, 'id' | 'createdAt'>) => Promise<void>;
  clearBookGrammar: (bookId: string) => Promise<void>;

  // Clear all cache for a book
  clearBookCache: (bookId: string) => Promise<void>;

  // Get cache stats
  getCacheStats: () => Promise<{ translationCount: number; qaCount: number; vocabCount: number; grammarCount: number }>;

  setHasHydrated: (state: boolean) => void;
}

export const useCacheStore = create<CacheState>()((_set, _get) => ({
  _hasHydrated: false,

  // Translation cache
  getTranslation: (bookId, chapterIndex, paragraphIndex, originalText) =>
    TranslationCache.get(bookId, chapterIndex, paragraphIndex, originalText),

  addTranslation: (entry) => TranslationCache.add(entry),

  clearBookTranslations: (bookId) => TranslationCache.clearByBook(bookId),

  clearAllTranslations: () => TranslationCache.clearAll(),

  // QA cache
  getQA: (bookId, question, context) => QACache.get(bookId, question, context),

  addQA: (entry) => QACache.add(entry),

  clearBookQA: (bookId) => QACache.clearByBook(bookId),

  clearAllQA: () => QACache.clearAll(),

  // Vocab cache
  getVocab: (bookId, chapterIndex, paragraphIndex, textHash) =>
    VocabCache.get(bookId, chapterIndex, paragraphIndex, textHash),

  addVocab: (entry) => VocabCache.add(entry),

  clearBookVocab: (bookId) => VocabCache.clearByBook(bookId),

  // Grammar cache
  getGrammar: (bookId, chapterIndex, paragraphIndex, textHash) =>
    GrammarCache.get(bookId, chapterIndex, paragraphIndex, textHash),

  addGrammar: (entry) => GrammarCache.add(entry),

  clearBookGrammar: (bookId) => GrammarCache.clearByBook(bookId),

  // Clear all cache for a book
  clearBookCache: async (bookId) => {
    await Promise.all([
      TranslationCache.clearByBook(bookId),
      QACache.clearByBook(bookId),
      VocabCache.clearByBook(bookId),
      GrammarCache.clearByBook(bookId),
    ]);
  },

  // Get cache stats
  getCacheStats: () => getCacheStats(),

  setHasHydrated: (state) => _set({ _hasHydrated: state }),
}));
