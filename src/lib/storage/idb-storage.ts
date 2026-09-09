/**
 * IndexedDB Storage Layer
 * Handles large data that would overflow localStorage:
 * - Book content and chapters
 * - Translation, QA, Vocab, Grammar caches
 */

const DB_NAME = 'zen-reader-db';
const DB_VERSION = 1;

const STORE_BOOK_CONTENT = 'book-contents';
const STORE_TRANSLATION = 'translation-cache';
const STORE_QA = 'qa-cache';
const STORE_VOCAB = 'vocab-cache';
const STORE_GRAMMAR = 'grammar-cache';
const STORE_META = 'meta';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_BOOK_CONTENT)) {
        db.createObjectStore(STORE_BOOK_CONTENT, { keyPath: 'bookId' });
      }
      if (!db.objectStoreNames.contains(STORE_TRANSLATION)) {
        db.createObjectStore(STORE_TRANSLATION, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_QA)) {
        db.createObjectStore(STORE_QA, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_VOCAB)) {
        db.createObjectStore(STORE_VOCAB, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_GRAMMAR)) {
        db.createObjectStore(STORE_GRAMMAR, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============= Book Content Storage =============

export interface BookContentData {
  bookId: string;
  content: string;
  chapters?: Array<{
    id: string;
    title: string;
    content: string;
    startIndex: number;
    endIndex: number;
  }>;
}

export const BookContentStorage = {
  async save(bookId: string, content: string, chapters?: BookContentData['chapters']): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_BOOK_CONTENT, 'readwrite');
    const store = tx.objectStore(STORE_BOOK_CONTENT);
    await promisifyRequest(store.put({ bookId, content, chapters }));
    db.close();
  },

  async get(bookId: string): Promise<BookContentData | null> {
    const db = await openDB();
    const tx = db.transaction(STORE_BOOK_CONTENT, 'readonly');
    const store = tx.objectStore(STORE_BOOK_CONTENT);
    const result = await promisifyRequest(store.get(bookId)) as BookContentData | null;
    db.close();
    return result;
  },

  async delete(bookId: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_BOOK_CONTENT, 'readwrite');
    const store = tx.objectStore(STORE_BOOK_CONTENT);
    await promisifyRequest(store.delete(bookId));
    db.close();
  },

  async clearAll(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_BOOK_CONTENT, 'readwrite');
    const store = tx.objectStore(STORE_BOOK_CONTENT);
    await promisifyRequest(store.clear());
    db.close();
  }
};

// ============= Cache Storage =============

export interface TranslationCacheEntry {
  id?: number;
  bookId: string;
  chapterIndex: number;
  paragraphIndex: number;
  originalText: string;
  translatedText: string;
  createdAt: Date;
}

export interface QACacheEntry {
  id?: number;
  bookId: string;
  question: string;
  context: string;
  answer: string;
  createdAt: Date;
}

export interface VocabCacheEntry {
  id?: number;
  bookId: string;
  chapterIndex: number;
  paragraphIndex: number;
  textHash: string;
  vocabulary: Array<{
    term: string;
    reading?: string;
    translation: string;
    context: string;
  }>;
  createdAt: Date;
}

export interface GrammarCacheEntry {
  id?: number;
  bookId: string;
  chapterIndex: number;
  paragraphIndex: number;
  textHash: string;
  grammar: Array<{
    structure: string;
    explanation: string;
    examples: string[];
  }>;
  createdAt: Date;
}

function textHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const result = await promisifyRequest(store.getAll()) as T[];
  db.close();
  return result;
}

async function putAllToStore<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await promisifyRequest(store.clear());
  for (const item of items) {
    await promisifyRequest(store.add(item));
  }
  db.close();
}

export const TranslationCache = {
  async get(bookId: string, chapterIndex: number, paragraphIndex: number, originalText: string): Promise<string | null> {
    const all = await getAllFromStore<TranslationCacheEntry>(STORE_TRANSLATION);
    const entry = all.find(
      (e) =>
        e.bookId === bookId &&
        e.chapterIndex === chapterIndex &&
        e.paragraphIndex === paragraphIndex &&
        e.originalText === originalText
    );
    return entry?.translatedText || null;
  },

  async add(entry: Omit<TranslationCacheEntry, 'id' | 'createdAt'>): Promise<void> {
    const all = await getAllFromStore<TranslationCacheEntry>(STORE_TRANSLATION);
    const filtered = all.filter(
      (e) =>
        !(e.bookId === entry.bookId &&
          e.chapterIndex === entry.chapterIndex &&
          e.paragraphIndex === entry.paragraphIndex)
    );
    const trimmed = filtered.slice(-500);
    const newEntries = [...trimmed, { ...entry, createdAt: new Date() }];
    await putAllToStore(STORE_TRANSLATION, newEntries);
  },

  async count(): Promise<number> {
    const db = await openDB();
    const tx = db.transaction(STORE_TRANSLATION, 'readonly');
    const store = tx.objectStore(STORE_TRANSLATION);
    const result = await promisifyRequest(store.count());
    db.close();
    return result;
  },

  async clearByBook(bookId: string): Promise<void> {
    const all = await getAllFromStore<TranslationCacheEntry>(STORE_TRANSLATION);
    const filtered = all.filter((e) => e.bookId !== bookId);
    await putAllToStore(STORE_TRANSLATION, filtered);
  },

  async clearAll(): Promise<void> {
    await putAllToStore(STORE_TRANSLATION, []);
  }
};

export const QACache = {
  async get(bookId: string, question: string, context: string): Promise<QACacheEntry | null> {
    const all = await getAllFromStore<QACacheEntry>(STORE_QA);
    const questionHash = textHash(question.toLowerCase());
    const contextHash = textHash(context.slice(0, 200));
    return (
      all.find(
        (e) =>
          e.bookId === bookId &&
          textHash(e.question.toLowerCase()) === questionHash &&
          textHash(e.context.slice(0, 200)) === contextHash
      ) || null
    );
  },

  async add(entry: Omit<QACacheEntry, 'id' | 'createdAt'>): Promise<void> {
    const all = await getAllFromStore<QACacheEntry>(STORE_QA);
    const trimmed = all.slice(-500);
    const newEntries = [...trimmed, { ...entry, createdAt: new Date() }];
    await putAllToStore(STORE_QA, newEntries);
  },

  async count(): Promise<number> {
    const db = await openDB();
    const tx = db.transaction(STORE_QA, 'readonly');
    const store = tx.objectStore(STORE_QA);
    const result = await promisifyRequest(store.count());
    db.close();
    return result;
  },

  async clearByBook(bookId: string): Promise<void> {
    const all = await getAllFromStore<QACacheEntry>(STORE_QA);
    const filtered = all.filter((e) => e.bookId !== bookId);
    await putAllToStore(STORE_QA, filtered);
  },

  async clearAll(): Promise<void> {
    await putAllToStore(STORE_QA, []);
  }
};

export const VocabCache = {
  async get(bookId: string, chapterIndex: number, paragraphIndex: number, hash: string): Promise<VocabCacheEntry['vocabulary'] | null> {
    const all = await getAllFromStore<VocabCacheEntry>(STORE_VOCAB);
    const entry = all.find(
      (e) =>
        e.bookId === bookId &&
        e.chapterIndex === chapterIndex &&
        e.paragraphIndex === paragraphIndex &&
        e.textHash === hash
    );
    return entry?.vocabulary || null;
  },

  async add(entry: Omit<VocabCacheEntry, 'id' | 'createdAt'>): Promise<void> {
    const all = await getAllFromStore<VocabCacheEntry>(STORE_VOCAB);
    const filtered = all.filter(
      (e) =>
        !(
          e.bookId === entry.bookId &&
          e.chapterIndex === entry.chapterIndex &&
          e.paragraphIndex === entry.paragraphIndex &&
          e.textHash === entry.textHash
        )
    );
    const trimmed = filtered.slice(-200);
    const newEntries = [...trimmed, { ...entry, createdAt: new Date() }];
    await putAllToStore(STORE_VOCAB, newEntries);
  },

  async count(): Promise<number> {
    const db = await openDB();
    const tx = db.transaction(STORE_VOCAB, 'readonly');
    const store = tx.objectStore(STORE_VOCAB);
    const result = await promisifyRequest(store.count());
    db.close();
    return result;
  },

  async clearByBook(bookId: string): Promise<void> {
    const all = await getAllFromStore<VocabCacheEntry>(STORE_VOCAB);
    const filtered = all.filter((e) => e.bookId !== bookId);
    await putAllToStore(STORE_VOCAB, filtered);
  },

  async clearAll(): Promise<void> {
    await putAllToStore(STORE_VOCAB, []);
  }
};

export const GrammarCache = {
  async get(bookId: string, chapterIndex: number, paragraphIndex: number, hash: string): Promise<GrammarCacheEntry['grammar'] | null> {
    const all = await getAllFromStore<GrammarCacheEntry>(STORE_GRAMMAR);
    const entry = all.find(
      (e) =>
        e.bookId === bookId &&
        e.chapterIndex === chapterIndex &&
        e.paragraphIndex === paragraphIndex &&
        e.textHash === hash
    );
    return entry?.grammar || null;
  },

  async add(entry: Omit<GrammarCacheEntry, 'id' | 'createdAt'>): Promise<void> {
    const all = await getAllFromStore<GrammarCacheEntry>(STORE_GRAMMAR);
    const filtered = all.filter(
      (e) =>
        !(
          e.bookId === entry.bookId &&
          e.chapterIndex === entry.chapterIndex &&
          e.paragraphIndex === entry.paragraphIndex &&
          e.textHash === entry.textHash
        )
    );
    const trimmed = filtered.slice(-200);
    const newEntries = [...trimmed, { ...entry, createdAt: new Date() }];
    await putAllToStore(STORE_GRAMMAR, newEntries);
  },

  async count(): Promise<number> {
    const db = await openDB();
    const tx = db.transaction(STORE_GRAMMAR, 'readonly');
    const store = tx.objectStore(STORE_GRAMMAR);
    const result = await promisifyRequest(store.count());
    db.close();
    return result;
  },

  async clearByBook(bookId: string): Promise<void> {
    const all = await getAllFromStore<GrammarCacheEntry>(STORE_GRAMMAR);
    const filtered = all.filter((e) => e.bookId !== bookId);
    await putAllToStore(STORE_GRAMMAR, filtered);
  },

  async clearAll(): Promise<void> {
    await putAllToStore(STORE_GRAMMAR, []);
  }
};

// ============= Meta Storage =============

export const MetaStorage = {
  async get(key: string): Promise<unknown> {
    const db = await openDB();
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const result = await promisifyRequest(store.get(key)) as { key: string; value: unknown } | undefined;
    db.close();
    return result?.value;
  },

  async set(key: string, value: unknown): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    await promisifyRequest(store.put({ key, value }));
    db.close();
  }
};

// ============= Utility =============

export async function getCacheStats(): Promise<{
  translationCount: number;
  qaCount: number;
  vocabCount: number;
  grammarCount: number;
}> {
  const [translationCount, qaCount, vocabCount, grammarCount] = await Promise.all([
    TranslationCache.count(),
    QACache.count(),
    VocabCache.count(),
    GrammarCache.count(),
  ]);
  return { translationCount, qaCount, vocabCount, grammarCount };
}

export async function clearAllCaches(): Promise<void> {
  await Promise.all([
    TranslationCache.clearAll(),
    QACache.clearAll(),
    VocabCache.clearAll(),
    GrammarCache.clearAll(),
  ]);
}

export async function clearBookAllData(bookId: string): Promise<void> {
  await Promise.all([
    BookContentStorage.delete(bookId),
    TranslationCache.clearByBook(bookId),
    QACache.clearByBook(bookId),
    VocabCache.clearByBook(bookId),
    GrammarCache.clearByBook(bookId),
  ]);
}
