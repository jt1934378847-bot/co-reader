'use client';

import { useMemo, useCallback } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TranslationSidebarProps {
  paragraphs: string[];
  translations: Record<number, string>;
  translatingIdcs: Set<number>;
  onTranslate: (index: number, text: string) => void;
  isConfigured: boolean;
}

export function TranslationSidebar({
  paragraphs,
  translations,
  translatingIdcs,
  onTranslate,
  isConfigured
}: TranslationSidebarProps) {
  // Split translation by sentences for better readability
  const splitSentences = useCallback((text: string): string[] => {
    if (!text) return [];
    return text.split(/(?<=[。！？.!?；;])/).filter(s => s.trim());
  }, []);

  return (
    <aside
      className="w-80 h-full overflow-y-auto border-l border-[var(--border-color)]"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Languages className="h-5 w-5 text-[var(--accent-primary)]" />
          <h2 className="font-semibold text-sm">译文对照</h2>
        </div>

        {!isConfigured && (
          <div className="p-3 rounded-lg text-xs text-center mb-4" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            请在设置中配置 API 密钥以启用翻译功能
          </div>
        )}

        {/* Translation list */}
        <div className="space-y-4">
          {paragraphs.map((para, index) => {
            const isTranslating = translatingIdcs.has(index);
            const translation = translations[index];

            return (
              <div key={index} className="border-l-2 pl-3" style={{ borderColor: 'var(--accent-primary)' }}>
                {/* Original text */}
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  #{index + 1}
                </p>
                <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-primary)' }}>
                  {para.length > 100 ? para.slice(0, 100) + '...' : para}
                </p>

                {/* Translation */}
                <div className="mt-2">
                  {isTranslating ? (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>翻译中...</span>
                    </div>
                  ) : translation ? (
                    <div className="space-y-1">
                      {splitSentences(translation).map((sentence, i) => (
                        <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {sentence}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => onTranslate(index, para)}
                      className="text-xs px-2 py-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                      style={{ color: 'var(--accent-primary)' }}
                      disabled={!isConfigured}
                    >
                      点击翻译
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
