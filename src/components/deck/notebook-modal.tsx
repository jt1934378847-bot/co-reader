'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Trash2, Highlighter, BookOpen } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHighlightStore } from '@/lib/stores/highlight-store';
import { useI18n } from '@/lib/i18n';

interface NotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId?: string;
}

export function NotebookModal({ isOpen, onClose, bookId }: NotebookModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const { highlights, removeHighlight } = useHighlightStore();

  const filteredHighlights = (bookId ? highlights.filter((h) => h.bookId === bookId) : highlights).filter(
    (h) => h.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.note && h.note.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('highlights')} size="lg">
      {/* Search */}
      <div className="mb-4">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`搜索${t('highlights')}...`}
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* Highlights List */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {filteredHighlights.length === 0 ? (
          <div className="text-center py-8">
            <Highlighter className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              {searchQuery ? `未找到匹配的${t('highlights')}` : `暂无${t('highlights')}`}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              选中文本后点击{t('highlight')}按钮添加
            </p>
          </div>
        ) : (
          filteredHighlights.map((entry) => (
            <div
              key={entry.id}
              className="p-3 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span
                      className="font-medium cursor-pointer hover:underline"
                      onClick={() => {
                        router.push(`/reader/${entry.bookId}?chapter=${entry.chapterIndex}`);
                        onClose();
                      }}
                    >
                      {entry.text.slice(0, 50)}{entry.text.length > 50 ? '...' : ''}
                    </span>
                  </div>
                  {entry.note && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {entry.note}
                    </p>
                  )}
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    来自: {entry.bookId.slice(0, 8)}... • 章节 {entry.chapterIndex + 1} • {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHighlight(entry.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats Footer */}
      <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
        <div className="flex gap-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            共 {highlights.length} 个{t('highlights')}
          </span>
        </div>
      </div>
    </Modal>
  );
}