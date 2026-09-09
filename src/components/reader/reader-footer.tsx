'use client';

import { useState, useEffect, useRef } from 'react';
import { Timer, BookMarked, ChevronUp, ChevronDown, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/lib/stores/session-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useI18n } from '@/lib/i18n';

interface ReaderFooterProps {
  onOpenNotebook: () => void;
  onOpenVocab: () => void;
}

export function ReaderFooter({ onOpenNotebook, onOpenVocab }: ReaderFooterProps) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const isTimerRunning = useSessionStore((state) => state.isTimerRunning);
  const currentSession = useSessionStore((state) => state.currentSession);
  const dailyStats = useSessionStore((state) => state.dailyStats);
  const _hasHydrated = useSessionStore((state) => state._hasHydrated);
  const [sessionDuration, setSessionDuration] = useState(0);
  const { fontSize, lineHeight, readingWidth, setFontSize, setLineHeight, setReadingWidth } = useSettingsStore();
  // Capture startTime in a ref to prevent timer restart on every store re-render
  const startTimeRef = useRef<number | null>(null);

  const todayStats = (() => {
    const today = new Date().toISOString().split('T')[0];
    return dailyStats.find((s) => s.date === today) || {
      date: today,
      readingTime: 0,
      wordsRead: 0,
      exercisesCompleted: 0,
      booksCompleted: 0
    };
  })();

  useEffect(() => {
    if (!isTimerRunning || !currentSession) {
      startTimeRef.current = null;
      return;
    }

    // Capture startTime once when session starts
    if (startTimeRef.current === null) {
      startTimeRef.current = new Date(currentSession.startTime).getTime();
    }

    const interval = setInterval(() => {
      if (startTimeRef.current !== null) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setSessionDuration(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, currentSession]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t border-[var(--border-color)] z-40"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      {/* Collapsed bar - use div instead of button to avoid nesting issues */}
      <div
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-[var(--accent-primary)]" />
            <span className="font-mono text-sm">
              {formatDuration(sessionDuration)}
            </span>
          </div>

          {/* Quick buttons - stop propagation to prevent toggle expand */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={onOpenVocab} title={t('vocabularyDeck')}>
              <BookOpen className="h-4 w-4 mr-1" />
              {t('vocabularyDeck')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onOpenNotebook} title={t('highlights')}>
              <BookMarked className="h-4 w-4 mr-1" />
              {t('highlights')}
            </Button>
          </div>
        </div>

        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </div>

      {/* Expanded stats */}
      {isExpanded && (
        <div className="px-4 pb-4 animate-slide-up">
          {/* Row 1: Session + Today */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2 rounded bg-[var(--bg-tertiary)]">
              <p className="text-xs text-[var(--text-muted)]">本次阅读</p>
              <p className="font-mono text-sm">{formatDuration(sessionDuration)}</p>
            </div>
            <div className="p-2 rounded bg-[var(--bg-tertiary)]">
              <p className="text-xs text-[var(--text-muted)]">今日累计</p>
              <p className="font-mono text-sm">
                {Math.floor(todayStats.readingTime / 3600)}h {Math.floor((todayStats.readingTime % 3600) / 60)}m
              </p>
            </div>
          </div>

          {/* Row 2: Typography controls */}
          <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
            <p className="text-xs text-[var(--text-muted)] mb-2">排版设置</p>
            <div className="grid grid-cols-3 gap-3">
              {/* Font size */}
              <div>
                <label className="text-xs text-[var(--text-muted)]">字号 {fontSize}px</label>
                <div className="flex items-center gap-1 mt-1">
                  <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">-</button>
                  <span className="text-xs w-6 text-center">{fontSize}</span>
                  <button onClick={() => setFontSize(Math.min(24, fontSize + 2))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">+</button>
                </div>
              </div>
              {/* Line height */}
              <div>
                <label className="text-xs text-[var(--text-muted)]">行高 {lineHeight.toFixed(1)}</label>
                <div className="flex items-center gap-1 mt-1">
                  <button onClick={() => setLineHeight(Math.max(1.2, +(lineHeight - 0.1).toFixed(1)))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">-</button>
                  <span className="text-xs w-6 text-center">{lineHeight.toFixed(1)}</span>
                  <button onClick={() => setLineHeight(Math.min(2.5, +(lineHeight + 0.1).toFixed(1)))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">+</button>
                </div>
              </div>
              {/* Reading width */}
              <div>
                <label className="text-xs text-[var(--text-muted)]">宽度 {readingWidth}px</label>
                <div className="flex items-center gap-1 mt-1">
                  <button onClick={() => setReadingWidth(Math.max(400, readingWidth - 20))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">-</button>
                  <span className="text-xs w-8 text-center">{readingWidth}</span>
                  <button onClick={() => setReadingWidth(Math.min(900, readingWidth + 20))} className="px-2 py-1 text-xs rounded bg-[var(--bg-tertiary)]">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
