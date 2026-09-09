export type BookLanguage = 'en' | 'ja' | 'ko' | 'zh';
export type BookFormat = 'epub' | 'pdf' | 'txt' | 'mobi' | 'azw3';
export type ReadingMode = 'immersion' | 'learning';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Book {
  id: string;
  title: string;
  author: string;
  language: BookLanguage;
  format: BookFormat;
  content: string;
  progress: number;
  lastReadAt: Date;
  addedAt: Date;
  coverImage?: string;
  totalWords: number;
  currentChapter?: number;
  chapters?: Chapter[];
  // Completion tracking
  completedAt?: Date;
  readChapterIndices?: number[];
  // Pre-translated content for faster display
  translations?: Record<string, string>; // chapterIndex_paragraphIndex -> translated content
  translationStatus?: {
    totalParagraphs: number;
    translatedParagraphs: number;
    lastTranslatedAt?: Date;
  };
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  startIndex: number;
  endIndex: number;
  translated?: boolean;
}

export interface VocabEntry {
  id: string;
  term: string;
  reading?: string;
  translation: string;
  bookId: string;
  bookTitle: string;
  context: string;
  createdAt: Date;
}

export interface GrammarPoint {
  id: string;
  structure: string;
  explanation: string;
  examples: string[];
  bookId: string;
  paragraphRef: string;
  createdAt: Date;
}

export interface BackTranslationResult {
  originalText: string;
  userTranslation: string;
  suggestedTranslation: string;
  score: number;
  feedback: string;
  improvements: string[];
}

export interface ReadingSession {
  bookId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  wordsRead: number;
  exercisesCompleted: number;
}

export interface DailyStats {
  date: string;
  readingTime: number;
  wordsRead: number;
  exercisesCompleted: number;
  booksCompleted: number;
}

export interface APIConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'moonshot' | 'custom';
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface AppSettings {
  theme: ThemeMode;
  fontSize: number;
  lineHeight: number;
  readingWidth: number;
  apiConfig: APIConfig | null;
}

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
