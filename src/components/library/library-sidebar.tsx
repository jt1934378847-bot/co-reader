'use client';

import { useCallback, useState, useEffect } from 'react';
import { Plus, Upload, FolderOpen } from 'lucide-react';
import { useLibraryStore } from '@/lib/stores/library-store';
import { useCacheStore } from '@/lib/stores/cache-store';
import { useHighlightStore } from '@/lib/stores/highlight-store';
import { useVocabStore } from '@/lib/stores/vocab-store';
import { useBookParser } from '@/lib/hooks/use-book-parser';
import { useTranslation } from '@/lib/hooks/use-translation';
import { BookCard } from './book-card';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import type { Book } from '@/lib/types';

export function LibrarySidebar() {
  const router = useRouter();
  const books = useLibraryStore((state) => state.books);
  const removeBook = useLibraryStore((state) => state.removeBook);
  const setCurrentBook = useLibraryStore((state) => state.setCurrentBook);
  const refresh = useLibraryStore((state) => state.refresh);
  const updateBook = useLibraryStore((state) => state.updateBook);
  const { importBook, isLoading } = useBookParser();
  const { addToast } = useToast();
  const { t } = useI18n();
  const { translateBook, isConfigured } = useTranslation();
  const [selectedBookId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Refresh books on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Translate book in background after import
  const translateBookInBackground = useCallback(async (book: Book) => {
    if (!isConfigured || book.translationStatus?.translatedParagraphs === book.translationStatus?.totalParagraphs) {
      return;
    }

    updateBook(book.id, {
      translationStatus: {
        totalParagraphs: book.translationStatus?.totalParagraphs || 0,
        translatedParagraphs: book.translationStatus?.translatedParagraphs || 0,
        lastTranslatedAt: new Date()
      }
    });

    try {
      // Initialize chapters as not translated
      if (book.chapters) {
        const initializedChapters = book.chapters.map(ch => ({ ...ch, translated: false }));
        updateBook(book.id, {
          chapters: initializedChapters,
          translations: {}
        });
      }

      await translateBook(
        book,
        // onChapterTranslated - called after each chapter is translated
        // Use getCurrentBook to avoid stale closure on book.chapters
        (chapterIndex: number, _translation: string) => {
          const currentBook = useLibraryStore.getState().books.find(b => b.id === book.id);
          if (currentBook?.chapters) {
            const updatedChapters = [...currentBook.chapters];
            if (updatedChapters[chapterIndex]) {
              updatedChapters[chapterIndex] = {
                ...updatedChapters[chapterIndex],
                translated: true
              };
              updateBook(book.id, { chapters: updatedChapters });
            }
          }
        },
        // onProgress
        (_progress) => {
          // Could update progress UI here if needed
        }
      );

      const totalParagraphs = book.chapters?.length || 0;
      updateBook(book.id, {
        translationStatus: {
          totalParagraphs,
          translatedParagraphs: totalParagraphs,
          lastTranslatedAt: new Date()
        }
      });
      addToast({
        type: 'success',
        message: `${book.title} 翻译完成`
      });
    } catch (err) {
      console.error('Translation failed:', err);
      updateBook(book.id, {
        translationStatus: {
          totalParagraphs: book.translationStatus?.totalParagraphs || 0,
          translatedParagraphs: book.translationStatus?.translatedParagraphs || 0,
          lastTranslatedAt: book.translationStatus?.lastTranslatedAt
        }
      });
    }
  }, [isConfigured, translateBook, updateBook, addToast]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const fileArray = Array.from(files);
      for (const file of fileArray) {
        const validTypes = ['.epub', '.pdf', '.txt', '.mobi', '.azw3'];
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        if (!validTypes.includes(ext)) {
          addToast({
            type: 'error',
            message: `不支持的格式: ${file.name}`
          });
          continue;
        }

        try {
          const book = await importBook(file);
          if (book) {
            const contentSize = new Blob([book.content]).size;
            const sizeMB = (contentSize / (1024 * 1024)).toFixed(2);

            if (contentSize > 5 * 1024 * 1024) {
              addToast({
                type: 'warning',
                message: `本书内容较大（${sizeMB} MB），建议转换为 EPUB 以获得最佳体验`
              });
            } else if (contentSize > 1 * 1024 * 1024) {
              addToast({
                type: 'info',
                message: `本书内容较大（${sizeMB} MB），已自动优化存储，不会占用过多浏览器空间`
              });
            }

            addToast({
              type: 'success',
              message: `${t('imported')}${book.title}`
            });
            translateBookInBackground(book);
            refresh();
          }
        } catch (err) {
          console.error('Import failed:', err);
          const message = err instanceof Error ? err.message : 'Failed to parse book';
          if (message === 'PDF_TOO_LARGE') {
            addToast({
              type: 'error',
              message: t('pdfTooLarge') || 'PDF 体积过大（>5MB），请转换为 EPUB 后导入'
            });
          } else if (message.includes('QuotaExceededError') || message.includes('exceeded the quota')) {
            addToast({
              type: 'error',
              message: '存储空间不足，请删除部分书籍后重试'
            });
          } else {
            addToast({
              type: 'error',
              message: `导入失败: ${file.name}`
            });
          }
        }
      }
      // Reset input
      e.target.value = '';
    },
    [importBook, addToast, t, refresh, translateBookInBackground]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        Array.from(files).forEach(async (file) => {
          const validTypes = ['.epub', '.pdf', '.txt', '.mobi', '.azw3'];
          const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
          if (!validTypes.includes(ext)) {
            addToast({
              type: 'error',
              message: `不支持的格式: ${file.name}`
            });
            return;
          }
          if (ext === '.pdf') {
            addToast({
              type: 'info',
              message: 'PDF 解析可能不完整，建议先转换为 TXT 或 EPUB 以获得最佳体验'
            });
          }
          const book = await importBook(file);
          if (book) {
            addToast({
              type: 'success',
              message: `${t('imported')}${book.title}`
            });
            translateBookInBackground(book);
            refresh();
          }
        });
      }
    },
    [importBook, addToast, t, refresh, translateBookInBackground]
  );

  const handleOpenBook = useCallback(
    (book: Book) => {
      setCurrentBook(book.id);
      router.push(`/reader/${book.id}`);
    },
    [setCurrentBook, router]
  );

  const handleDeleteBook = useCallback(
    (bookId: string) => {
      // Clean up associated data in other stores
      useCacheStore.getState().clearBookCache(bookId);
      useHighlightStore.getState().clearBookHighlights(bookId);
      useVocabStore.getState().clearBookVocabs(bookId);

      removeBook(bookId);
      addToast({ type: 'info', message: t('bookRemoved') });
      refresh();
    },
    [removeBook, addToast, t, refresh]
  );

  return (
    <aside className="w-60 h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-color)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="h-5 w-5 text-[var(--accent-primary)]" />
          <h2 className="font-semibold text-sm" suppressHydrationWarning>{t('library')}</h2>
          <span className="ml-auto text-xs text-[var(--text-muted)]" suppressHydrationWarning>{books.length}{t('books')}</span>
        </div>

        <label
          className="w-full h-8 px-3 flex items-center justify-center gap-2 text-xs font-medium rounded-lg transition-all duration-150 bg-[var(--accent-primary)] text-white hover:brightness-110 active:scale-[0.98] cursor-pointer"
          suppressHydrationWarning
        >
          {isLoading ? '加载中...' : <><Plus className="h-4 w-4" /> {t('importBook')}</>}
          <input
            type="file"
            accept=".epub,.pdf,.txt,.mobi,.azw3"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>
      </div>

      {/* Book list */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3 relative"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 bg-[var(--accent-primary)]/10 border-2 border-dashed border-[var(--accent-primary)] rounded-xl flex items-center justify-center z-10">
            <div className="text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-[var(--accent-primary)]" />
              <p className="text-sm font-medium">{t('dropToImport')}</p>
            </div>
          </div>
        )}

        {books.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]" suppressHydrationWarning>{t('noBooks')}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1" suppressHydrationWarning>
              {t('noBooksHint')}
            </p>
          </div>
        ) : (
          books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isSelected={selectedBookId === book.id}
              onDelete={() => handleDeleteBook(book.id)}
              onOpen={() => handleOpenBook(book)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
