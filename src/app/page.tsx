'use client';

import { LibrarySidebar } from '@/components/library/library-sidebar';
import { Header } from '@/components/library/header';
import { NotebookModal } from '@/components/deck/notebook-modal';
import { VocabDeckModal } from '@/components/deck/vocab-modal';
import { BookMarked, Clock, BookOpen, Highlighter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { useLibraryStore } from '@/lib/stores/library-store';
import { useSessionStore } from '@/lib/stores/session-store';
import { useVocabStore } from '@/lib/stores/vocab-store';
import { useHighlightStore } from '@/lib/stores/highlight-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [showNotebookModal, setShowNotebookModal] = useState(false);
  const [showVocabModal, setShowVocabModal] = useState(false);
  const { t } = useI18n();
  const router = useRouter();
  const books = useLibraryStore((state) => state.books);
  const setCurrentBook = useLibraryStore((state) => state.setCurrentBook);

  const dailyStats = useSessionStore((state) => state.dailyStats);
  const _hasHydrated = useSessionStore((state) => state._hasHydrated);
  const vocabulary = useVocabStore((state) => state.vocabulary);
  const highlights = useHighlightStore((state) => state.highlights);
  const { customWallpaper, wallpaperOpacity } = useSettingsStore();
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return dailyStats.find((s) => s.date === today) || {
      date: today,
      readingTime: 0,
      wordsRead: 0,
      exercisesCompleted: 0,
      booksCompleted: 0
    };
  }, [dailyStats, _hasHydrated]);

  // Weekly reading streak calculation
  const weeklyStats = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday...
    // Adjust to make Monday=0, Sunday=6
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const weekDays: Array<{ date: string; label: string; read: boolean; minutes: number }> = [];
    const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayStats = dailyStats.find((s) => s.date === dateStr);
      const minutes = dayStats ? Math.floor(dayStats.readingTime / 60) : 0;
      weekDays.push({
        date: dateStr,
        label: dayLabels[i],
        read: minutes > 0,
        minutes
      });
    }

    const streakDays = weekDays.filter((d) => d.read).length;
    const totalMinutes = weekDays.reduce((sum, d) => sum + d.minutes, 0);

    return { weekDays, streakDays, totalMinutes };
  }, [dailyStats, _hasHydrated]);

  const handleOpenBook = (bookId: string) => {
    setCurrentBook(bookId);
    router.push(`/reader/${bookId}`);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Library Sidebar */}
        <LibrarySidebar />

        {/* Main Content */}
        <main className="relative flex-1 flex flex-col items-center justify-center p-8">
          {/* Home page wallpaper background - low opacity */}
          {customWallpaper && (
            <>
              <div
                className="fixed inset-0 -z-10"
                style={{
                  backgroundImage: `url(${customWallpaper})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: Math.min(wallpaperOpacity / 100, 0.08), // Cap at 8% for home page
                }}
              />
              <div className="fixed inset-0 -z-10 dark:bg-black/30" style={{ opacity: 0.4 }} />
            </>
          )}
          {books.length === 0 ? (
            /* Empty state */
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center mx-auto mb-6">
                <BookMarked className="h-10 w-10 text-[var(--accent-primary)]" />
              </div>

              <h1 className="text-2xl font-serif font-semibold mb-3">
                {t('welcome')}
              </h1>
              <p className="text-sm mb-6 whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                {t('welcomeDesc')}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                  className="w-full sm:w-auto"
                >
                  {t('importFirstBook')}
                </Button>

                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setShowNotebookModal(true)}
                  className="w-full sm:w-auto"
                >
                  <BookMarked className="h-4 w-4 mr-2" />
                  {t('notebook')}
                </Button>
              </div>

              <div className="mt-8 space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                  支持格式与推荐
                </p>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span><strong>EPUB</strong> — 推荐，章节识别最准确</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                    <span><strong>MOBI/AZW3</strong> — 支持导入，章节标题可能需手动校正</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span><strong>PDF</strong> — 仅限纯文字版且 &lt; 5MB，扫描版或大图请转 EPUB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <span><strong>TXT</strong> — 支持导入，无章节结构</span>
                  </div>
                </div>
                <p className="mt-2 text-[10px] opacity-70">
                  提示：大体积文件（PDF &gt; 5MB）可能导入失败，建议先用 Calibre 转为 EPUB
                </p>
              </div>
            </div>
          ) : (
            /* Books exist - show dashboard */
            <div className="w-full max-w-5xl">
              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <Card padding="md">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span className="text-xs text-[var(--text-muted)]">本周打卡</span>
                  </div>
                  {/* Weekly heatmap */}
                  <div className="flex items-center gap-1 mb-2">
                    {weeklyStats.weekDays.map((day, idx) => (
                      <div key={day.date} className="flex flex-col items-center gap-0.5">
                        <div
                          className={`w-5 h-5 rounded-sm ${
                            day.read
                              ? 'bg-[var(--accent-primary)]'
                              : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)]'
                          }`}
                          title={`${day.date}: ${day.minutes > 0 ? `${day.minutes}分钟` : '未阅读'}`}
                        />
                        <span className="text-[10px] text-[var(--text-muted)]">{day.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    已打卡 <span className="font-semibold text-[var(--text-primary)]">{weeklyStats.streakDays}</span>/7 天 · 累计 {Math.floor(weeklyStats.totalMinutes / 60)}h{weeklyStats.totalMinutes % 60}m
                  </div>
                </Card>

                <Card padding="md">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span className="text-xs text-[var(--text-muted)]">{t('todaysReading')}</span>
                  </div>
                  <p className="text-2xl font-semibold">{formatTime(todayStats.readingTime)}</p>
                </Card>

                <Card
                  padding="md"
                  className="cursor-pointer hover:border-[var(--accent-primary)] transition-colors"
                  onClick={() => setShowVocabModal(true)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <BookMarked className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span className="text-xs text-[var(--text-muted)]">{t('vocabularyDeck')}</span>
                  </div>
                  <p className="text-2xl font-semibold">{vocabulary.length}</p>
                  <p className="text-xs text-[var(--text-muted)]">按书查看</p>
                </Card>

                <Card
                  padding="md"
                  className="cursor-pointer hover:border-[var(--accent-primary)] transition-colors"
                  onClick={() => setShowNotebookModal(true)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Highlighter className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span className="text-xs text-[var(--text-muted)]">{t('highlights')}</span>
                  </div>
                  <p className="text-2xl font-semibold">{highlights.length}</p>
                  <p className="text-xs text-[var(--text-muted)]">全部书籍</p>
                </Card>
              </div>

              {/* Books Grid */}
              <div className="mb-4">
                <h2 className="text-lg font-semibold mb-3">我的书房</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {books.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => handleOpenBook(book.id)}
                    className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)] hover:shadow-lg transition-all text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-16 rounded bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 overflow-hidden">
                        {book.coverImage ? (
                          <img src={book.coverImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <BookMarked className="h-6 w-6 text-[var(--accent-primary)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{book.title}</h3>
                        {book.author && (
                          <p className="text-xs text-[var(--text-muted)] truncate">{book.author}</p>
                        )}
                        <div className="mt-2">
                          <div className="h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--accent-primary)] transition-all"
                              style={{ width: `${book.progress}%` }}
                            />
                          </div>
                          <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--text-muted)' }}>
                            {book.progress}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <NotebookModal isOpen={showNotebookModal} onClose={() => setShowNotebookModal(false)} />
      <VocabDeckModal isOpen={showVocabModal} onClose={() => setShowVocabModal(false)} />
    </div>
  );
}
