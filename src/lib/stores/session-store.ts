import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ReadingSession, DailyStats } from '@/lib/types';

interface SessionState {
  currentSession: ReadingSession | null;
  dailyStats: DailyStats[];
  isTimerRunning: boolean;
  _hasHydrated: boolean;
  startSession: (bookId: string) => void;
  endSession: () => void;
  updateSession: (updates: Partial<ReadingSession>) => void;
  addWordsRead: (count: number) => void;
  incrementExercises: () => void;
  incrementBooksCompleted: () => void;
  getTodayStats: () => DailyStats;
  setHasHydrated: (state: boolean) => void;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      dailyStats: [],
      isTimerRunning: false,
      _hasHydrated: false,

      startSession: (bookId) => set({
        currentSession: {
          bookId,
          startTime: new Date(),
          duration: 0,
          wordsRead: 0,
          exercisesCompleted: 0
        },
        isTimerRunning: true
      }),

      endSession: () => {
        const { currentSession, dailyStats } = get();
        if (!currentSession) return;

        const today = getTodayString();
        const endTime = new Date();
        const duration = Math.floor((endTime.getTime() - new Date(currentSession.startTime).getTime()) / 1000);

        const todayStats = dailyStats.find((s) => s.date === today) || {
          date: today,
          readingTime: 0,
          wordsRead: 0,
          exercisesCompleted: 0,
          booksCompleted: 0
        };

        set({
          currentSession: null,
          isTimerRunning: false,
          dailyStats: [
            ...dailyStats.filter((s) => s.date !== today),
            {
              ...todayStats,
              readingTime: todayStats.readingTime + duration,
              wordsRead: todayStats.wordsRead + currentSession.wordsRead,
              exercisesCompleted: todayStats.exercisesCompleted + currentSession.exercisesCompleted
            }
          ]
        });
      },

      updateSession: (updates) => set((state) => ({
        currentSession: state.currentSession
          ? { ...state.currentSession, ...updates }
          : null
      })),

      addWordsRead: (count) => set((state) => ({
        currentSession: state.currentSession
          ? { ...state.currentSession, wordsRead: state.currentSession.wordsRead + count }
          : null
      })),

      incrementExercises: () => set((state) => ({
        currentSession: state.currentSession
          ? { ...state.currentSession, exercisesCompleted: state.currentSession.exercisesCompleted + 1 }
          : null
      })),

      incrementBooksCompleted: () => set((state) => {
        const today = getTodayString();
        const todayStats = state.dailyStats.find((s) => s.date === today) || {
          date: today,
          readingTime: 0,
          wordsRead: 0,
          exercisesCompleted: 0,
          booksCompleted: 0
        };
        return {
          dailyStats: [
            ...state.dailyStats.filter((s) => s.date !== today),
            {
              ...todayStats,
              booksCompleted: todayStats.booksCompleted + 1
            }
          ]
        };
      }),

      getTodayStats: () => {
        const { dailyStats } = get();
        const today = getTodayString();
        return dailyStats.find((s) => s.date === today) || {
          date: today,
          readingTime: 0,
          wordsRead: 0,
          exercisesCompleted: 0,
          booksCompleted: 0
        };
      },

      setHasHydrated: (state) => set({ _hasHydrated: state })
    }),
    {
      name: 'zen-reader-session',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
