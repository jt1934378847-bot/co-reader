'use client';

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useSettingsStore } from '@/lib/stores/settings-store';
import type { Book, BookLanguage } from '@/lib/types';
import type { Highlight } from '@/lib/stores/highlight-store';

interface ReaderContentProps {
  book: Book;
  onSelectParagraph?: (text: string, index: number) => void;
  onProgressUpdate?: (progress: number) => void;
  currentChapter?: number;
  bookLanguage: BookLanguage;
  showTranslation?: boolean;
  // External translation state - all managed by parent
  translations?: Record<number, string>;
  translatingIdcs?: Set<number>;
  onTranslate?: (index: number, text: string) => void;
  // Highlights
  highlights?: Highlight[];
  onHighlightClick?: (highlight: Highlight) => void;
  // Next chapter
  hasNextChapter?: boolean;
  onNextChapter?: () => void;
}

export function ReaderContent({
  book,
  onSelectParagraph,
  onProgressUpdate,
  currentChapter = 0,
  showTranslation = false,
  translations = {},
  translatingIdcs = new Set(),
  onTranslate,
  highlights = [],
  onHighlightClick,
  hasNextChapter = false,
  onNextChapter
}: ReaderContentProps) {
  const { fontSize, lineHeight, readingWidth } = useSettingsStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Group paragraphs by chapter if chapters exist
  const chaptersData = useMemo(() => {
    if (!book.chapters || book.chapters.length === 0) {
      return null;
    }
    return book.chapters;
  }, [book.chapters]);

  // Smart paragraph segmentation - groups sentences into readable chunks
  const segmentParagraphs = useCallback((content: string): string[] => {
    const MAX_PARAGRAPH_LENGTH = 350;

    const rawParagraphs = content
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const segmented: string[] = [];
    const sentenceEnders = /[。．.！？!?\n…——；]/;

    for (const para of rawParagraphs) {
      if (para.length <= MAX_PARAGRAPH_LENGTH) {
        segmented.push(para);
        continue;
      }

      const sentences: string[] = [];
      let currentSentence = '';

      for (let i = 0; i < para.length; i++) {
        currentSentence += para[i];
        if (sentenceEnders.test(para[i]) && currentSentence.length > 10) {
          sentences.push(currentSentence.trim());
          currentSentence = '';
        }
      }
      if (currentSentence.trim()) {
        sentences.push(currentSentence.trim());
      }

      let currentPara = '';
      for (const sentence of sentences) {
        if (!sentence) continue;

        if ((currentPara + sentence).length > MAX_PARAGRAPH_LENGTH && currentPara) {
          segmented.push(currentPara.trim());
          currentPara = sentence;
        } else {
          currentPara += sentence;
        }
      }

      if (currentPara.trim()) {
        segmented.push(currentPara.trim());
      }
    }

    if (segmented.length < 3 && content.length > 1000) {
      const forced: string[] = [];
      let current = '';
      for (const char of content) {
        current += char;
        if (sentenceEnders.test(char) && current.length >= 200) {
          forced.push(current.trim());
          current = '';
        }
      }
      if (current.trim()) forced.push(current.trim());
      return forced.length > 0 ? forced : segmented;
    }

    return segmented;
  }, []);

  // Get current chapter's paragraphs
  const currentChapterParagraphs = useMemo(() => {
    if (!chaptersData || chaptersData.length === 0) {
      return segmentParagraphs(book.content);
    }
    const chapter = chaptersData[currentChapter];
    if (!chapter) {
      return segmentParagraphs(book.content);
    }
    return segmentParagraphs(chapter.content);
  }, [chaptersData, currentChapter, book.content, segmentParagraphs]);

  // Compute display paragraphs
  const displayParagraphs = chaptersData ? currentChapterParagraphs : segmentParagraphs(book.content);

  const handleParagraphClick = useCallback(
    (text: string, index: number) => {
      setSelectedIndex(index);
      onSelectParagraph?.(text, index);

      // Trigger translation callback - parent handles all translation logic
      if (showTranslation && onTranslate && !translations[index] && !translatingIdcs.has(index)) {
        onTranslate(index, text);
      }
    },
    [onSelectParagraph, showTranslation, onTranslate, translations, translatingIdcs]
  );

  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onProgressUpdate) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const scrollable = scrollHeight - clientHeight;
    if (scrollable <= 0) return;
    const scrollProgress = Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));

    let progress = scrollProgress;
    if (chaptersData && chaptersData.length > 0) {
      const chaptersProgress = ((currentChapter + (scrollProgress / 100)) / chaptersData.length) * 100;
      progress = Math.min(100, Math.round(chaptersProgress));
    }

    onProgressUpdate(progress);
  }, [chaptersData, currentChapter, onProgressUpdate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentChapter]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-4 py-8"
      style={{ fontSize: `${fontSize}px` }}
    >
      <article
        className="mx-auto reading-text"
        style={{
          maxWidth: `${readingWidth}px`,
          lineHeight: lineHeight
        }}
      >
        {showTranslation && onTranslate && (
          <div className="mb-6 pb-4 border-b border-[var(--border-color)]">
            <button
              onClick={() => {
                displayParagraphs.forEach((para, index) => {
                  if (!translations[index] && !translatingIdcs.has(index)) {
                    onTranslate(index, para);
                  }
                });
              }}
              className="w-full py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--accent-primary)',
                border: '1px solid var(--accent-primary)'
              }}
            >
              {translatingIdcs.size > 0 ? `翻译中 (${translatingIdcs.size} 段)...` : '翻译本章全部段落'}
            </button>
          </div>
        )}
        {displayParagraphs.map((para, index) => {
          const paraHighlights = highlights.filter(h =>
            h.chapterIndex === currentChapter &&
            (para.includes(h.text) || h.text.includes(para.slice(0, 50)))
          );

          return (
            <div key={`${currentChapter}-${index}`} className="mb-6">
              <p
                onClick={() => handleParagraphClick(para, index)}
                className={`
                  cursor-pointer transition-all duration-200
                  ${selectedIndex === index ? 'border-l-4 border-[var(--accent-primary)] pl-4 -ml-5' : ''}
                  ${paraHighlights.length > 0 ? 'border-l-4 border-yellow-400 pl-4 -ml-5' : ''}
                  hover:bg-[var(--bg-secondary)]/50 rounded
                `}
                style={{
                  lineHeight: lineHeight
                }}
              >
                {para}
                {paraHighlights.length > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: paraHighlights[0].color }}
                    />
                    <span className="text-[10px] text-[var(--text-muted)]">{paraHighlights.length}</span>
                  </span>
                )}
              </p>

              {paraHighlights.length > 0 && (
                <div className="mt-1 space-y-1">
                  {paraHighlights.map((h) => (
                    <div
                      key={h.id}
                      className="p-2 rounded text-xs border-l-2 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        borderColor: h.color,
                        color: 'var(--text-secondary)'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onHighlightClick?.(h);
                      }}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: h.color }}
                        />
                        <span className="font-medium">"{h.text.slice(0, 30)}{h.text.length > 30 ? '...' : ''}"</span>
                      </div>
                      {h.note && <p className="ml-3">{h.note}</p>}
                    </div>
                  ))}
                </div>
              )}

              {showTranslation && (
                <div className="mt-2 pl-4 border-l-2" style={{ borderColor: 'var(--accent-primary)' }}>
                  {translatingIdcs.has(index) ? (
                    <span className="text-sm text-[var(--text-muted)]">正在翻译...</span>
                  ) : translations[index] ? (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {translations[index]}
                    </p>
                  ) : (
                    <span
                      className="text-sm text-[var(--text-muted)] cursor-pointer hover:text-[var(--accent-primary)] transition-colors"
                      onClick={() => onTranslate?.(index, para)}
                    >
                      点击翻译
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Chapter end */}
        <div className="mt-12 mb-8 text-center">
          <div className="inline-flex flex-col items-center gap-3">
            <span className="text-xs text-[var(--text-muted)]">— 本章结束 —</span>
            {hasNextChapter && onNextChapter && (
              <button
                onClick={onNextChapter}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'white'
                }}
              >
                下一章 →
              </button>
            )}
            {!hasNextChapter && (
              <span className="text-xs text-[var(--text-muted)]">全书完</span>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
