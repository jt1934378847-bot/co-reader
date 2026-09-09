'use client';

import { useState, useCallback, useRef } from 'react';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { LLMFetcher } from '@/lib/llm/fetcher';
import type { Message } from '@/lib/types';

export function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiConfig = useSettingsStore((s) => s.apiConfig);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (messages: Message[]): Promise<string> => {
      if (!apiConfig) {
        throw new Error('API not configured. Please set up your API key in Settings.');
      }

      setIsLoading(true);
      setError(null);

      abortControllerRef.current = new AbortController();
      const fetcher = new LLMFetcher(apiConfig);
      const signal = abortControllerRef.current.signal;

      try {
        const chunks: string[] = [];
        for await (const chunk of fetcher.streamGenerate(messages, signal)) {
          chunks.push(chunk);
        }
        return chunks.join('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI request failed';
        // Detect rate limit errors
        if (message.includes('429')) {
          setError('请求过于频繁，请稍后再试（Rate Limit）');
        } else {
          setError(message);
        }
        throw err;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [apiConfig]
  );

  const generateWithCallback = useCallback(
    async (messages: Message[], onChunk: (chunk: string) => void): Promise<string> => {
      if (!apiConfig) {
        throw new Error('API not configured. Please set up your API key in Settings.');
      }

      setIsLoading(true);
      setError(null);

      abortControllerRef.current = new AbortController();
      const fetcher = new LLMFetcher(apiConfig);
      const signal = abortControllerRef.current.signal;

      try {
        const chunks: string[] = [];
        for await (const chunk of fetcher.streamGenerate(messages, signal)) {
          chunks.push(chunk);
          onChunk(chunk);
        }
        return chunks.join('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI request failed';
        // Detect rate limit errors
        if (message.includes('429')) {
          setError('请求过于频繁，请稍后再试（Rate Limit）');
        } else {
          setError(message);
        }
        throw err;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [apiConfig]
  );

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    generate,
    generateWithCallback,
    isLoading,
    error,
    abort,
    isConfigured: !!apiConfig
  };
}
