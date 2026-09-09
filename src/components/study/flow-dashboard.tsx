'use client';

import { useState, useEffect } from 'react';
import { Timer, BookOpen, Target, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useSessionStore } from '@/lib/stores/session-store';
import { useTimer } from '@/lib/hooks/use-timer';
import { useI18n } from '@/lib/i18n';

export function FlowDashboard() {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const { isTimerRunning, getTodayStats } = useSessionStore();
  const { getSessionDuration, formatDuration } = useTimer();
  const [sessionDuration, setSessionDuration] = useState(0);

  const todayStats = getTodayStats();

  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      setSessionDuration(getSessionDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, getSessionDuration]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}小时${mins}分钟`;
    return `${mins}分钟`;
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t border-[var(--border-color)]"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      {/* Collapsed bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-[var(--accent-primary)]" />
            <span className="font-mono text-sm">
              {isTimerRunning ? formatDuration(sessionDuration) : '00:00'}
            </span>
          </div>

          {/* Quick stats */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {todayStats.wordsRead} {t('wordsRead')}
            </span>
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              {todayStats.exercisesCompleted} {t('exercises')}
            </span>
          </div>
        </div>

        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </button>

      {/* Expanded stats */}
      {isExpanded && (
        <div className="px-4 pb-4 animate-slide-up">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card padding="sm">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="text-xs text-[var(--text-muted)]">{t('todaysReading')}</span>
              </div>
              <p className="text-lg font-semibold">{formatTime(todayStats.readingTime)}</p>
            </Card>

            <Card padding="sm">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="text-xs text-[var(--text-muted)]">{t('wordsRead')}</span>
              </div>
              <p className="text-lg font-semibold">{todayStats.wordsRead.toLocaleString()}</p>
            </Card>

            <Card padding="sm">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="text-xs text-[var(--text-muted)]">{t('exercises')}</span>
              </div>
              <p className="text-lg font-semibold">{todayStats.exercisesCompleted}</p>
            </Card>

            <Card padding="sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="text-xs text-[var(--text-muted)]">{t('booksDone')}</span>
              </div>
              <p className="text-lg font-semibold">{todayStats.booksCompleted}</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
