'use client';

import type { Book } from '@/lib/types';

interface ReadingProgressProps {
  progress: number;
  book: Book;
  currentChapter?: number;
  onChapterSelect?: (chapterIndex: number) => void;
}

export function ReadingProgress({
  progress,
  book
}: ReadingProgressProps) {
  // Chapter navigation is now in the left sidebar TableOfContents
  // This component only shows the reading progress bar

  return (
    <div className="h-1 bg-[var(--bg-tertiary)] w-full relative">
      <div
        className="h-full bg-[var(--accent-primary)] transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
