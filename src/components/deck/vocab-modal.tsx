'use client';

import { useState, useCallback, useMemo } from 'react';
import { BookMarked, Trash2, Search, Download, BookOpen, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVocabStore } from '@/lib/stores/vocab-store';
import { useLibraryStore } from '@/lib/stores/library-store';
import { useI18n } from '@/lib/i18n';

interface VocabDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId?: string;
}

export function VocabDeckModal({ isOpen, onClose, bookId }: VocabDeckModalProps) {
  const { t } = useI18n();
  const { vocabulary, grammarPoints, removeVocab, removeGrammar, exportToPrintableCSV, exportToReviewCSV, exportToAnki, exportToPrintableHTML } = useVocabStore();
  const libraryBooks = useLibraryStore((state) => state.books);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'books' | 'words'>(bookId ? 'words' : 'books');
  const [activeBookId, setActiveBookId] = useState<string | null>(bookId || null);
  const [activeTab, setActiveTab] = useState<'vocab' | 'grammar'>('vocab');

  // Group vocabulary by book for the books list view
  const booksWithVocab = useMemo(() => {
    const bookIds = [...new Set(vocabulary.map((v) => v.bookId))];
    return bookIds.map((id) => {
      const book = libraryBooks.find((b) => b.id === id);
      const words = vocabulary.filter((v) => v.bookId === id);
      return {
        id,
        title: book?.title || '未知书籍',
        author: book?.author,
        coverImage: book?.coverImage,
        wordCount: words.length
      };
    }).sort((a, b) => b.wordCount - a.wordCount);
  }, [vocabulary, libraryBooks]);

  // When viewing a specific book, filter to that book's words
  const displayVocab = useMemo(() => {
    if (activeBookId) {
      return vocabulary.filter((v) => v.bookId === activeBookId);
    }
    return vocabulary;
  }, [vocabulary, activeBookId]);

  const filteredVocab = displayVocab.filter(
    (v) =>
      v.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.translation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter grammar points
  const displayGrammar = useMemo(() => {
    if (activeBookId) {
      return grammarPoints.filter((g) => g.bookId === activeBookId);
    }
    return grammarPoints;
  }, [grammarPoints, activeBookId]);

  const filteredGrammar = displayGrammar.filter(
    (g) =>
      g.structure.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.explanation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const downloadFile = useCallback((content: string, filename: string, type: string) => {
    const bom = type.includes('csv') ? '\ufeff' : '';
    const blob = new Blob([bom + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportPrintableCSV = useCallback((items: typeof vocabulary) => {
    downloadFile(exportToPrintableCSV(items), '默写表.csv', 'text/csv;charset=utf-8');
  }, [exportToPrintableCSV, downloadFile]);

  const handleExportReviewCSV = useCallback((items: typeof vocabulary) => {
    downloadFile(exportToReviewCSV(items), '对照表.csv', 'text/csv;charset=utf-8');
  }, [exportToReviewCSV, downloadFile]);

  const handleExportAnki = useCallback((items: typeof vocabulary) => {
    downloadFile(exportToAnki(items), 'anki-import.txt', 'text/plain');
  }, [exportToAnki, downloadFile]);

  const handleExportPrintableHTML = useCallback((items: typeof vocabulary) => {
    const html = exportToPrintableHTML(items);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [exportToPrintableHTML]);

  const handleDelete = useCallback(
    (id: string) => {
      removeVocab(id);
    },
    [removeVocab]
  );

  const handleDeleteGrammar = useCallback(
    (id: string) => {
      removeGrammar(id);
    },
    [removeGrammar]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!bookId) {
          setViewMode('books');
          setActiveBookId(null);
          setSelectedIds([]);
          setSearchQuery('');
          setActiveTab('vocab');
        }
        onClose();
      }}
      title={
        viewMode === 'words' && activeBookId && !bookId
          ? (booksWithVocab.find(b => b.id === activeBookId)?.title || t('vocabularyDeck'))
          : t('vocabularyDeck')
      }
      size="lg"
    >
      {/* Back button when viewing a specific book from main page */}
      {viewMode === 'words' && !bookId && (
        <div className="mb-3">
          <button
            onClick={() => {
              setViewMode('books');
              setActiveBookId(null);
              setSelectedIds([]);
              setSearchQuery('');
              setActiveTab('vocab');
            }}
            className="flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            返回书籍列表
          </button>
        </div>
      )}

      {/* Search and Export - only in words view */}
      {viewMode === 'words' && (
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchVocab')}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="relative">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={activeTab === 'grammar' ? filteredGrammar.length === 0 : filteredVocab.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              {t('export')}
            </Button>
            {showExportMenu && activeTab === 'vocab' && (
              <div className="absolute right-0 top-full mt-1 py-1 w-56 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-lg z-10 animate-fade-in">
                <div className="px-3 py-1.5 text-xs text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  导出 {selectedIds.length > 0 ? selectedIds.length : filteredVocab.length} 个单词
                </div>
                <button
                  onClick={() => {
                    const items = selectedIds.length > 0
                      ? filteredVocab.filter((v) => selectedIds.includes(v.id))
                      : filteredVocab;
                    handleExportPrintableCSV(items);
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                >
                  <span>✏️</span>
                  <div>
                    <div className="font-medium">CSV 默写表</div>
                    <div className="text-xs text-[var(--text-muted)]">释义 → 空白栏</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    const items = selectedIds.length > 0
                      ? filteredVocab.filter((v) => selectedIds.includes(v.id))
                      : filteredVocab;
                    handleExportReviewCSV(items);
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                >
                  <span>📋</span>
                  <div>
                    <div className="font-medium">CSV 对照表</div>
                    <div className="text-xs text-[var(--text-muted)]">单词 → 释义</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    const items = selectedIds.length > 0
                      ? filteredVocab.filter((v) => selectedIds.includes(v.id))
                      : filteredVocab;
                    handleExportPrintableHTML(items);
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                >
                  <span>🖨️</span>
                  <div>
                    <div className="font-medium">打印 / PDF</div>
                    <div className="text-xs text-[var(--text-muted)]">打开新标签页打印为PDF</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    const items = selectedIds.length > 0
                      ? filteredVocab.filter((v) => selectedIds.includes(v.id))
                      : filteredVocab;
                    handleExportAnki(items);
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                >
                  <span>🎴</span>
                  <div>
                    <div className="font-medium">Anki 导入</div>
                    <div className="text-xs text-[var(--text-muted)]">制表符分隔格式</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab switcher - only in words view */}
      {viewMode === 'words' && (
        <div className="flex gap-1 mb-3 p-1 rounded-lg bg-[var(--bg-tertiary)]">
          <button
            onClick={() => setActiveTab('vocab')}
            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'vocab'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            词汇 ({filteredVocab.length})
          </button>
          <button
            onClick={() => setActiveTab('grammar')}
            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'grammar'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            语法 ({filteredGrammar.length})
          </button>
        </div>
      )}

      {/* Select all checkbox - only for vocab tab */}
      {viewMode === 'words' && activeTab === 'vocab' && (
        <div className="flex items-center gap-3 mb-3 px-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filteredVocab.length > 0 && selectedIds.length === filteredVocab.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(filteredVocab.map((v) => v.id));
                } else {
                  setSelectedIds([]);
                }
              }}
              className="h-4 w-4 rounded border-[var(--border-color)] accent-[var(--accent-primary)]"
            />
            <span className="text-[var(--text-secondary)]">
              {selectedIds.length > 0 ? `已选择 ${selectedIds.length}/${filteredVocab.length}` : '全选'}
            </span>
          </label>
          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-[var(--accent-primary)] hover:underline"
            >
              取消选择
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {viewMode === 'books' ? (
          /* === Books list view === */
          booksWithVocab.length === 0 ? (
            <div className="text-center py-12">
              <BookMarked className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4 opacity-50" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                还没有添加任何生词
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                在阅读时选中单词即可添加
              </p>
            </div>
          ) : (
            booksWithVocab.map((book) => (
              <button
                key={book.id}
                onClick={() => {
                  setActiveBookId(book.id);
                  setViewMode('words');
                  setSelectedIds([]);
                  setSearchQuery('');
                  setActiveTab('vocab');
                }}
                className="w-full p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] transition-all text-left flex items-center gap-3"
              >
                <div className="w-10 h-14 rounded bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 overflow-hidden">
                  {book.coverImage ? (
                    <img src={book.coverImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="h-5 w-5 text-[var(--accent-primary)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{book.title}</h3>
                  {book.author && (
                    <p className="text-xs text-[var(--text-muted)] truncate">{book.author}</p>
                  )}
                  <p className="text-xs mt-1 text-[var(--accent-primary)]">
                    {book.wordCount} 个生词
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
            ))
          )
        ) : activeTab === 'vocab' ? (
          /* === Vocabulary list view === */
          filteredVocab.length === 0 ? (
            <div className="text-center py-12">
              <BookMarked className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4 opacity-50" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {vocabulary.length === 0 ? t('noVocab') : t('noMatchVocab')}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t('noVocabHint')}
              </p>
            </div>
          ) : (
            filteredVocab.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded-lg border transition-colors group cursor-pointer ${
                  selectedIds.includes(entry.id)
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                    : 'border-[var(--border-color)] hover:bg-[var(--bg-secondary)]'
                }`}
                onClick={() => {
                  setSelectedIds((prev) =>
                    prev.includes(entry.id)
                      ? prev.filter((id) => id !== entry.id)
                      : [...prev, entry.id]
                  );
                }}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(entry.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedIds((prev) =>
                        e.target.checked
                          ? [...prev, entry.id]
                          : prev.filter((id) => id !== entry.id)
                      );
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 rounded border-[var(--border-color)] accent-[var(--accent-primary)] flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.term}</span>
                      {entry.reading && (
                        <span className="text-xs text-[var(--text-muted)]">[{entry.reading}]</span>
                      )}
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {entry.translation}
                    </p>
                    <p className="text-xs mt-2 italic" style={{ color: 'var(--text-muted)' }}>
                      &quot;{entry.context}&quot;
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      来源: {entry.bookTitle}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(entry.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )
        ) : (
          /* === Grammar list view === */
          filteredGrammar.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4 opacity-50" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                还没有添加任何语法要点
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                在阅读时选中文本使用 AI 分析语法即可添加
              </p>
            </div>
          ) : (
            filteredGrammar.map((point) => (
              <div
                key={point.id}
                className="p-3 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
                      <span className="font-medium text-sm">{point.structure}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {point.explanation}
                    </p>
                    {point.examples && point.examples.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {point.examples.map((ex, j) => (
                          <p key={j} className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                            • {ex}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      来源段落: {point.paragraphRef.slice(0, 60)}{point.paragraphRef.length > 60 ? '...' : ''}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteGrammar(point.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Stats */}
      {viewMode === 'words' && activeTab === 'vocab' && filteredVocab.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)] flex items-center justify-between">
          <span>
            {t('total')}: {filteredVocab.length} {t('wordsSaved')}
            {activeBookId && ` · ${booksWithVocab.find(b => b.id === activeBookId)?.title}`}
          </span>
        </div>
      )}
      {viewMode === 'words' && activeTab === 'grammar' && filteredGrammar.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
          共 {filteredGrammar.length} 个语法要点
          {activeBookId && ` · ${booksWithVocab.find(b => b.id === activeBookId)?.title}`}
        </div>
      )}
      {viewMode === 'books' && booksWithVocab.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
          共 {booksWithVocab.length} 本书有生词 · 总计 {vocabulary.length} 个单词
        </div>
      )}
    </Modal>
  );
}
