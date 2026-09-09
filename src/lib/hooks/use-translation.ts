'use client';

import { useState, useCallback, useRef } from 'react';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { LLMFetcher } from '@/lib/llm/fetcher';
import { cleanAIResponse } from '@/lib/utils';
import type { Book, BookLanguage, Message } from '@/lib/types';

interface TranslationProgress {
  current: number;
  total: number;
  chapterTitle?: string;
}

// Split text into chunks that won't exceed API limits (approx 2000 chars per chunk)
function chunkText(text: string, maxChars: number = 2000): string[] {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    // Handle paragraphs that exceed maxChars on their own
    if (para.length > maxChars) {
      // First flush current chunk if non-empty
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // Split the long paragraph by sentences/phrase boundaries
      const sentences = para.split(/(?<=[。！？.!?；;])/);
      let tempChunk = '';
      for (const sentence of sentences) {
        if ((tempChunk + sentence).length > maxChars && tempChunk) {
          chunks.push(tempChunk.trim());
          tempChunk = sentence;
        } else {
          tempChunk += (tempChunk ? '' : '') + sentence;
        }
      }
      if (tempChunk.trim()) {
        currentChunk = tempChunk.trim();
      }
      continue;
    }

    if ((currentChunk + para).length > maxChars && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Translate a single text chunk
async function translateChunk(
  fetcher: LLMFetcher,
  text: string,
  sourceLang: string,
  signal?: AbortSignal
): Promise<string> {
  const messages: Message[] = [
    {
      id: 'sys',
      role: 'system',
      content: `你是一位专业译者。你的任务是将以下${sourceLang}文本翻译成中文（简体中文）。

【严格规则】
1. 只输出中文译文，不要输出任何其他内容
2. 不要包含分析、解释、备注或任何说明
3. 不要使用引号包裹译文
4. 不要输出任何标签如<thinking>、<reasoning>等
5. 不要输出英文或其他语言
6. 保持原文的语气和风格

请直接输出译文：`,
      timestamp: new Date()
    },
    { id: 'user', role: 'user', timestamp: new Date(), content: text }
  ];

  const chunks: string[] = [];
  for await (const chunk of fetcher.streamGenerate(messages, signal)) {
    chunks.push(chunk);
  }
  return cleanAIResponse(chunks.join(''));
}

export function useTranslation() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apiConfig = useSettingsStore((s) => s.apiConfig);
  const isConfigured = !!apiConfig;

  const translateBook = useCallback(async (
    book: Book,
    onChapterTranslated?: (chapterIndex: number, translation: string) => void,
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<Record<number, string>> => {
    if (!isConfigured || !apiConfig) {
      throw new Error('API not configured');
    }

    const fetcher = new LLMFetcher(apiConfig);
    const translations: Record<number, string> = {};
    const total = book.chapters?.length || 1;

    setIsTranslating(true);
    setError(null);
    abortRef.current = new AbortController();

    try {
      if (!book.chapters || book.chapters.length === 0) {
        // Single chapter - translate in chunks
        setProgress({ current: 1, total: 1, chapterTitle: '全文' });
        onProgress?.({ current: 1, total: 1, chapterTitle: '全文' });
        const chunks = chunkText(book.content);
        const translatedChunks: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
          if (abortRef.current?.signal.aborted) break;
          try {
            const translated = await translateChunk(fetcher, chunks[i], getLanguageName(book.language), abortRef.current?.signal);
            translatedChunks.push(translated);
          } catch (err) {
            console.error(`Chunk ${i} failed:`, err);
            translatedChunks.push(`[翻译失败: ${chunks[i].slice(0, 50)}...]`);
          }
          // Wait between chunks to avoid rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        translations[0] = translatedChunks.join('\n');
        onChapterTranslated?.(0, translations[0]);
      } else {
        // Multi-chapter - translate chapter by chapter
        for (let i = 0; i < total; i++) {
          if (abortRef.current?.signal.aborted) break;

          const chapter = book.chapters[i];
          setProgress({ current: i + 1, total, chapterTitle: chapter.title });
          onProgress?.({ current: i + 1, total, chapterTitle: chapter.title });

          // Split long chapters into chunks
          const textChunks = chunkText(chapter.content);
          const translatedChunks: string[] = [];

          for (let j = 0; j < textChunks.length; j++) {
            if (abortRef.current?.signal.aborted) break;
            try {
              const translated = await translateChunk(fetcher, textChunks[j], getLanguageName(book.language), abortRef.current?.signal);
              translatedChunks.push(translated);
            } catch (err) {
              console.error(`Chapter ${i} chunk ${j} failed:`, err);
              translatedChunks.push(`[翻译失败]`);
            }
            // Wait between chunks to avoid rate limiting
            if (j < textChunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          translations[i] = translatedChunks.join('\n');
          onChapterTranslated?.(i, translations[i]);
        }
      }

      return translations;
    } finally {
      setIsTranslating(false);
      setProgress(null);
      abortRef.current = null;
    }
  }, [isConfigured, apiConfig]);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  return {
    translateBook,
    abort,
    isTranslating,
    progress,
    error,
    isConfigured
  };
}

function getLanguageName(lang: BookLanguage): string {
  const map: Record<BookLanguage, string> = {
    en: 'English',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese'
  };
  return map[lang] || 'text';
}
