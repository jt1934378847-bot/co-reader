'use client';

import { useState, useCallback, useEffect, use, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Eye, GraduationCap, BookMarked, Languages, Moon, Sun, Sparkles, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useLibraryStore } from '@/lib/stores/library-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useHighlightStore } from '@/lib/stores/highlight-store';
import type { Highlight } from '@/lib/stores/highlight-store';
import { useVocabStore } from '@/lib/stores/vocab-store';
import { useSessionStore } from '@/lib/stores/session-store';
import { useCacheStore } from '@/lib/stores/cache-store';
import { useAI } from '@/lib/hooks/use-ai';
import { ReaderContent } from '@/components/reader/reader-content';
import { ReadingProgress } from '@/components/reader/reading-progress';
import { SelectionPopover } from '@/components/reader/selection-popover';
import { AIStudyPanel } from '@/components/study/ai-sidebar';
import { VocabDeckModal } from '@/components/deck/vocab-modal';
import { ReaderFooter } from '@/components/reader/reader-footer';
import { NotebookModal } from '@/components/deck/notebook-modal';
import { TableOfContents } from '@/components/reader/table-of-contents';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n';
import { getLanguageName, getTargetLanguage, cleanAIResponse, globalTranslationCache } from '@/lib/utils';
import type { ReadingMode, VocabEntry, GrammarPoint, Message } from '@/lib/types';

export default function ReaderPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { addToast } = useToast();
  const { t } = useI18n();

  const books = useLibraryStore((state) => state.books);
  const getBookWithContent = useLibraryStore((state) => state.getBookWithContent);
  const updateBook = useLibraryStore((state) => state.updateBook);
  const addVocab = useVocabStore((state) => state.addVocab);
  const addGrammar = useVocabStore((state) => state.addGrammar);
  const startSession = useSessionStore((state) => state.startSession);
  const endSession = useSessionStore((state) => state.endSession);
  const { theme, setTheme, customWallpaper, wallpaperOpacity, wallpaperBlur } = useSettingsStore();

  // Find book metadata from books array
  const bookMeta = books.find((b) => b.id === id);
  const [book, setBook] = useState(bookMeta || null);

  // Load full book content from IndexedDB when needed
  useEffect(() => {
    if (!bookMeta) {
      setBook(null);
      return;
    }

    // If content already loaded, use it
    if (bookMeta.content) {
      setBook(bookMeta);
      return;
    }

    // Load from IndexedDB
    getBookWithContent(id).then((fullBook) => {
      if (fullBook) setBook(fullBook);
    });
  }, [bookMeta, id, getBookWithContent]);

  const [mode, setMode] = useState<ReadingMode>('immersion');
  const [showTableOfContents, setShowTableOfContents] = useState(true);
  const [selectedParagraph, setSelectedParagraph] = useState<string | null>(null);
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState<number>(0);
  const [showVocabModal, setShowVocabModal] = useState(false);
  const [showNotebookModal, setShowNotebookModal] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [progress, setProgress] = useState(() => book?.progress || 0);
  const [currentChapter, setCurrentChapter] = useState<number>(() => book?.currentChapter || 0);

  // Completion tracking - use ref to prevent duplicate triggers within session
  const completedRef = useRef(false);

  // Track reading start time for minimum reading time validation
  const readingStartTimeRef = useRef<Date | null>(null);

  // Selection popover state
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [initialAIQuestion, setInitialAIQuestion] = useState<string>('');

  // Shared translation state
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translatingIdcs, setTranslatingIdcs] = useState<Set<number>>(new Set());

  // Highlight state
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const addHighlight = useHighlightStore((state) => state.addHighlight);
  const removeHighlight = useHighlightStore((state) => state.removeHighlight);
  const allHighlights = useHighlightStore((state) => state.highlights);
  const bookHighlights = useMemo(
    () => allHighlights.filter((h) => h.bookId === book?.id),
    [allHighlights, book?.id]
  );

  // AI translation hook
  const { generate, isConfigured } = useAI();

  // Cache store for translations
  const getTranslation = useCacheStore((state) => state.getTranslation);
  const addTranslation = useCacheStore((state) => state.addTranslation);

  useEffect(() => {
    if (book) {
      startSession(book.id);
    }
    return () => {
      endSession();
    };
  }, [book, startSession, endSession]);

  const handleSelectParagraph = useCallback((text: string, index: number) => {
    setSelectedParagraph(text);
    setSelectedParagraphIndex(index);
  }, []);

  // Translate a specific paragraph
  const handleTranslateParagraph = useCallback(async (index: number, text: string) => {
    if (!isConfigured || !text.trim()) return;
    if (translations[index]) return;

    // 1. Check global in-memory cache first (fastest)
    if (globalTranslationCache.has(text)) {
      const cached = globalTranslationCache.get(text)!;
      setTranslations(prev => ({ ...prev, [index]: cached }));
      return;
    }

    // 2. Check persistent cache-store (async)
    const storeCached = await getTranslation(id, currentChapter, index, text);
    if (storeCached) {
      globalTranslationCache.set(text, storeCached);
      setTranslations(prev => ({ ...prev, [index]: storeCached }));
      return;
    }

    setTranslatingIdcs(prev => new Set(prev).add(index));

    try {
      const targetLang = getTargetLanguage(book?.language || 'en');
      const messages: Message[] = [
        {
          id: 'sys',
          role: 'system',
          timestamp: new Date(),
          content: `你是一位专业译者。请将以下${getLanguageName(book?.language || 'en')}文本翻译成${targetLang}（${targetLang}）。

【严格规则】
1. 只输出译文，不要输出任何其他内容
2. 不要包含分析、解释、备注或任何说明
3. 不要使用引号包裹译文
4. 不要输出任何标签
5. 保持原文的语气和风格

请直接输出译文：`
        },
        { id: 'user', role: 'user', timestamp: new Date(), content: text }
      ];

      const result = await generate(messages);
      const clean = cleanAIResponse(result);

      // 3. Save to both caches
      globalTranslationCache.set(text, clean);
      addTranslation({
        bookId: id,
        chapterIndex: currentChapter,
        paragraphIndex: index,
        originalText: text,
        translatedText: clean
      });

      setTranslations(prev => ({ ...prev, [index]: clean }));
    } catch (err) {
      console.error('翻译失败:', err);
      const errorMsg = err instanceof Error ? err.message : '翻译失败';
      if (errorMsg.includes('429')) {
        addToast({ type: 'error', message: '请求过于频繁，请稍后重试' });
      } else {
        addToast({ type: 'error', message: `翻译失败: ${errorMsg}` });
      }
    } finally {
      setTranslatingIdcs(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  }, [isConfigured, id, currentChapter, book?.language, generate, addToast, getTranslation, addTranslation, translations]);

  const handleProgressUpdate = useCallback(
    (newProgress: number) => {
      setProgress(newProgress);
      if (!book) return;

      // Record reading start time on first progress update
      if (!readingStartTimeRef.current && newProgress > 0) {
        readingStartTimeRef.current = new Date();
      }

      // Track chapter visits for chapter-weighted validation
      const readChapterIndices = book.readChapterIndices || [];
      if (book.chapters && book.chapters.length > 0 && !readChapterIndices.includes(currentChapter)) {
        updateBook(book.id, {
          readChapterIndices: [...readChapterIndices, currentChapter]
        });
      }

      // Use threshold >= 98 instead of === 100 to handle scroll calculation errors
      const wasCompleted = (book.progress ?? 0) >= 98 || !!book.completedAt;
      const isNowCompleted = newProgress >= 98;
      updateBook(book.id, { progress: newProgress, lastReadAt: new Date() });

      // Mark book as completed when progress reaches threshold (with duplicate prevention)
      if (!completedRef.current && !wasCompleted && isNowCompleted) {
        // Minimum reading time validation (2 minutes) to prevent instant triggers
        const readingTime = readingStartTimeRef.current
          ? Date.now() - readingStartTimeRef.current.getTime()
          : 0;

        if (readingTime < 120000) {
          // Less than 2 minutes - user likely just scrolled quickly, skip
          return;
        }

        // Chapter validation: if book has chapters, ensure user has visited most of them
        if (book.chapters && book.chapters.length > 0) {
          const chapterCoverage = (book.readChapterIndices?.length || 0) / book.chapters.length;
          if (chapterCoverage < 0.8) {
            // Hasn't read at least 80% of chapters, skip completion
            return;
          }
        }

        completedRef.current = true;
        useSessionStore.getState().incrementBooksCompleted();
        updateBook(book.id, { completedAt: new Date() });
      }
    },
    [book, currentChapter, updateBook]
  );

  const handleChapterSelect = useCallback(
    (chapterIndex: number) => {
      setCurrentChapter(chapterIndex);
      setTranslations({}); // 清空上一章节的译文
      if (book) {
        updateBook(book.id, { currentChapter: chapterIndex });
      }
    },
    [book, updateBook]
  );

  const handleAddToVocab = useCallback(
    (entry: { term: string; reading?: string; translation: string; context: string }) => {
      const newEntry: VocabEntry = {
        id: `vocab-${Date.now()}`,
        term: entry.term,
        reading: entry.reading,
        translation: entry.translation,
        context: entry.context,
        bookId: book?.id || '',
        bookTitle: book?.title || '',
        createdAt: new Date()
      };
      addVocab(newEntry);
      addToast({ type: 'success', message: t('addedToVocab') });
    },
    [book, addVocab, addToast, t]
  );

  const handleAddGrammar = useCallback(
    (point: { structure: string; explanation: string; examples: string[] }) => {
      const newPoint: GrammarPoint = {
        id: `grammar-${Date.now()}`,
        structure: point.structure,
        explanation: point.explanation,
        examples: point.examples,
        bookId: book?.id || '',
        paragraphRef: selectedParagraph || '',
        createdAt: new Date()
      };
      addGrammar(newPoint);
      addToast({ type: 'success', message: '已添加到语法笔记！' });
    },
    [book, selectedParagraph, addGrammar, addToast]
  );

  // Handle text selection for popover
  const handleTextSelection = useCallback((_e: MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 0) {
      const range = selection?.getRangeAt(0);
      if (range) {
        const rect = range.getBoundingClientRect();
        setSelectionPosition({ x: rect.left + rect.width / 2, y: rect.top });
        setSelectedText(text);
      }
    }
    // Don't clear selectionPosition here - let buttons handle their own clicks
  }, []);

  // Handle selection popover actions
  const handleTranslateSelection = useCallback(() => {
    if (selectedText) {
      setSelectedParagraph(selectedText);
    }
    setSelectionPosition(null);
  }, [selectedText]);

  const handleAddVocabFromSelection = useCallback(() => {
    if (selectedText && book) {
      handleAddToVocab({
        term: selectedText,
        translation: '',
        context: selectedText
      });
    }
    setSelectionPosition(null);
  }, [selectedText, book, handleAddToVocab]);

  const handleHighlightSelection = useCallback(() => {
    if (selectedText && book) {
      setPendingHighlight(selectedText);
      setNoteText('');
      setShowNoteDialog(true);
    }
    setSelectionPosition(null);
  }, [selectedText, book]);

  const handleSaveHighlight = useCallback(() => {
    if (pendingHighlight && book) {
      addHighlight({
        bookId: book.id,
        chapterIndex: currentChapter,
        text: pendingHighlight,
        note: noteText.trim() || undefined,
        color: '#FBBF24'
      });
      addToast({
        type: 'success',
        message: '已添加高光笔记'
      });
    }
    setShowNoteDialog(false);
    setPendingHighlight(null);
    setNoteText('');
  }, [pendingHighlight, book, currentChapter, noteText, addHighlight, addToast]);

  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [editingNote, setEditingNote] = useState('');

  const handleHighlightClick = useCallback((highlight: Highlight) => {
    setEditingHighlight(highlight);
    setEditingNote(highlight.note || '');
  }, []);

  const handleSaveHighlightEdit = useCallback(() => {
    if (editingHighlight) {
      useHighlightStore.getState().updateHighlightNote(editingHighlight.id, editingNote);
      addToast({ type: 'success', message: '已更新笔记' });
    }
    setEditingHighlight(null);
    setEditingNote('');
  }, [editingHighlight, editingNote, addToast]);

  const handleDeleteHighlight = useCallback(() => {
    if (editingHighlight) {
      removeHighlight(editingHighlight.id);
      addToast({ type: 'info', message: '已删除高光笔记' });
    }
    setEditingHighlight(null);
    setEditingNote('');
  }, [editingHighlight, removeHighlight, addToast]);

  const handleAskAISelection = useCallback(() => {
    if (selectedText) {
      setSelectedParagraph(selectedText);
      // Add quotes around selected text for better AI context
      setInitialAIQuestion(`"${selectedText}" 请分析这句话的语法结构并解释其含义。`);
      setMode('learning');
    }
    setSelectionPosition(null);
  }, [selectedText]);

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, [handleTextSelection]);

  if (!book) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-[var(--text-muted)]" />
          <h2 className="text-lg font-semibold mb-2">书籍未找到</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            书籍可能已被删除或导入失败
          </p>
          <Button variant="secondary" onClick={() => router.push('/')}>
            返回书库
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm hover:text-[var(--accent-primary)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('backToLibrary')}</span>
          </button>

          <div className="h-4 w-px bg-[var(--border-color)]" />

          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate max-w-[200px]">{book.title}</span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border-color)] overflow-hidden">
            <button
              onClick={() => setMode('immersion')}
              className={`
                px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors
                ${mode === 'immersion'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
                }
              `}
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('immersion')}</span>
            </button>
            <button
              onClick={() => setMode('learning')}
              className={`
                px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors
                ${mode === 'learning'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
                }
              `}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('learning')}</span>
            </button>
          </div>

          {/* Translation toggle */}
          <Button
            variant={showTranslation ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setShowTranslation(!showTranslation)}
            title={showTranslation ? '关闭翻译' : '翻译为中文'}
          >
            <Languages className="h-4 w-4" />
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
            title={t('theme')}
          >
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </Button>

          {/* Table of Contents toggle */}
          {book.chapters && book.chapters.length > 0 && (
            <Button
              variant={showTableOfContents ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setShowTableOfContents(!showTableOfContents)}
              title={showTableOfContents ? '隐藏目录' : '显示目录'}
            >
              {showTableOfContents ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </header>

      {/* Progress bar */}
      <ReadingProgress
        progress={progress}
        book={book}
        currentChapter={currentChapter}
      />

      {/* Custom Wallpaper Background */}
      {customWallpaper && (
        <>
          <div
            className="fixed inset-0 -z-10"
            style={{
              backgroundImage: `url(${customWallpaper})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: wallpaperOpacity / 100,
              filter: wallpaperBlur > 0 ? `blur(${wallpaperBlur}px)` : undefined,
            }}
          />
          {/* Dark overlay for readability in dark mode */}
          <div
            className="fixed inset-0 -z-10 dark:bg-black/50"
            style={{ opacity: 0.5 }}
          />
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Table of Contents (show when book has chapters and toggle is on) */}
        {book.chapters && book.chapters.length > 0 && showTableOfContents && (
          <TableOfContents
            book={book}
            currentChapter={currentChapter}
            onChapterSelect={handleChapterSelect}
          />
        )}

        {/* Reader area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ReaderContent
            book={book}
            onSelectParagraph={handleSelectParagraph}
            onProgressUpdate={handleProgressUpdate}
            currentChapter={currentChapter}
            bookLanguage={book?.language || 'en'}
            showTranslation={showTranslation}
            translations={translations}
            translatingIdcs={translatingIdcs}
            onTranslate={handleTranslateParagraph}
            highlights={bookHighlights}
            onHighlightClick={handleHighlightClick}
            hasNextChapter={book.chapters ? currentChapter < book.chapters.length - 1 : false}
            onNextChapter={() => {
              if (book.chapters && currentChapter < book.chapters.length - 1) {
                handleChapterSelect(currentChapter + 1);
              }
            }}
          />
        </div>

        {/* AI Sidebar - Learning mode */}
        {mode === 'learning' && (
          <AIStudyPanel
            selectedText={selectedParagraph || ''}
            context={book?.content?.substring(0, 500) || ''}
            bookLanguage={book?.language || 'en'}
            bookId={book?.id || ''}
            chapterIndex={currentChapter}
            paragraphIndex={selectedParagraphIndex}
            initialQuestion={initialAIQuestion}
            onAddVocab={handleAddToVocab}
            onAddGrammar={handleAddGrammar}
          />
        )}
      </div>

      {/* Selection Popover */}
      {selectionPosition && selectedText && (
        <SelectionPopover
          position={selectionPosition}
          selectedText={selectedText}
          onTranslate={handleTranslateSelection}
          onHighlight={handleHighlightSelection}
          onAskAI={handleAskAISelection}
          onClose={() => setSelectionPosition(null)}
        />
      )}

      {/* Vocab Modal */}
      <VocabDeckModal isOpen={showVocabModal} onClose={() => setShowVocabModal(false)} bookId={book?.id} />

      {/* Notebook Modal */}
      <NotebookModal isOpen={showNotebookModal} onClose={() => setShowNotebookModal(false)} bookId={book?.id} />

      {/* Reader Footer with Timer and Notebook */}
      <ReaderFooter
        onOpenNotebook={() => setShowNotebookModal(true)}
        onOpenVocab={() => setShowVocabModal(true)}
      />

      {/* Edit Highlight Dialog */}
      {editingHighlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md p-4 rounded-xl shadow-xl border border-[var(--border-color)]"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            <h3 className="font-semibold mb-3">编辑高光笔记</h3>
            <div className="mb-3 p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                &ldquo;{editingHighlight.text.slice(0, 100)}{editingHighlight.text.length > 100 ? '...' : ''}&rdquo;
              </p>
            </div>
            <textarea
              value={editingNote}
              onChange={(e) => setEditingNote(e.target.value)}
              placeholder="修改笔记..."
              className="w-full p-2 rounded-lg border border-[var(--border-color)] text-sm min-h-[100px] resize-none"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
              autoFocus
            />
            <div className="flex justify-between gap-2 mt-3">
              <Button variant="danger" size="sm" onClick={handleDeleteHighlight}>
                删除
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditingHighlight(null)}>
                  取消
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveHighlightEdit}>
                  保存
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Highlight Note Dialog */}
      {showNoteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md p-4 rounded-xl shadow-xl border border-[var(--border-color)]"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            <h3 className="font-semibold mb-3">添加高光笔记</h3>
            <div className="mb-3 p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <p className="font-medium mb-1">选中的文本：</p>
              <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                &ldquo;{pendingHighlight?.slice(0, 100)}{pendingHighlight && pendingHighlight.length > 100 ? '...' : ''}&rdquo;
              </p>
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="添加笔记（可选）..."
              className="w-full p-2 rounded-lg border border-[var(--border-color)] text-sm min-h-[100px] resize-none"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="secondary" size="sm" onClick={() => setShowNoteDialog(false)}>
                取消
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveHighlight}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
