'use client';

import { useState, useCallback } from 'react';
import { parseBook } from '@/lib/parsers';
import { useLibraryStore } from '@/lib/stores/library-store';
import type { Book } from '@/lib/types';

export function useBookParser() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const addBook = useLibraryStore((s) => s.addBook);

  const importBook = useCallback(
    async (file: File): Promise<Book | null> => {
      setIsLoading(true);
      setProgress(0);
      setError(null);

      try {
        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
          setProgress((p) => Math.min(p + 10, 90));
        }, 200);

        const book = await parseBook(file);

        clearInterval(progressInterval);
        setProgress(100);

        addBook(book);
        return book;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to parse book';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [addBook]
  );

  const importBooks = useCallback(
    async (files: FileList | File[]): Promise<Book[]> => {
      const fileArray = Array.from(files);
      const books: Book[] = [];

      for (const file of fileArray) {
        const book = await importBook(file);
        if (book) books.push(book);
      }

      return books;
    },
    [importBook]
  );

  return {
    importBook,
    importBooks,
    isLoading,
    progress,
    error
  };
}
