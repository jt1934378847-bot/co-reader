'use client';

import { useCallback } from 'react';
import { ChevronRight, BookOpen, Check } from 'lucide-react';
import type { Book } from '@/lib/types';

interface TableOfContentsProps {
  book: Book;
  currentChapter: number;
  onChapterSelect: (index: number) => void;
}

export function TableOfContents({
  book,
  currentChapter,
  onChapterSelect
}: TableOfContentsProps) {
  const chapters = book.chapters || [];

  const handleChapterClick = useCallback(
    (index: number) => {
      onChapterSelect(index);
    },
    [onChapterSelect]
  );

  return (
    <aside className="w-56 h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-color)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[var(--accent-primary)]" />
          <span className="font-medium text-sm truncate">{book.title}</span>
        </div>
        {book.author && (
          <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
            {book.author}
          </p>
        )}
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto py-2">
        <p className="px-3 py-1 text-xs text-[var(--text-muted)] uppercase tracking-wide">
          目录
        </p>
        {chapters.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[var(--text-muted)]">
            无章节信息
          </p>
        ) : (
          chapters.map((chapter, index) => (
            <button
              key={chapter.id}
              onClick={() => handleChapterClick(index)}
              className={`
                w-full px-3 py-2 text-left text-sm flex items-start gap-2
                transition-colors hover:bg-[var(--bg-tertiary)]
                ${
                  currentChapter === index
                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                    : chapter.translated === false
                    ? 'text-[var(--text-muted)]'
                    : 'text-[var(--text-primary)]'
                }
              `}
            >
              <span className="mt-0.5 flex-shrink-0">
                {currentChapter === index ? (
                  <Check className="h-3 w-3" />
                ) : chapter.translated === false ? (
                  <span className="h-3 w-3 rounded-full border border-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="h-3 w-3 opacity-50" />
                )}
              </span>
              <span className="flex-1 line-clamp-2">{chapter.title}</span>
            </button>
          ))
        )}
      </div>

      {/* Footer stats */}
      <div className="p-3 border-t border-[var(--border-color)]">
        <p className="text-xs text-[var(--text-muted)]">
          {chapters.filter(c => c.translated).length}/{chapters.length} 章节已翻译
        </p>
      </div>
    </aside>
  );
}
