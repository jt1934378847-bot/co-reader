'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '@/lib/stores/session-store';

export function useTimer() {
  const { currentSession, isTimerRunning, startSession, endSession } = useSessionStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const tick = useCallback(() => {
    // Timer is managed by the store
  }, []);

  useEffect(() => {
    if (isTimerRunning && currentSession) {
      intervalRef.current = setInterval(tick, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTimerRunning, currentSession, tick]);

  const formatDuration = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getSessionDuration = useCallback((): number => {
    if (!currentSession) return 0;
    const now = new Date();
    return Math.floor((now.getTime() - new Date(currentSession.startTime).getTime()) / 1000);
  }, [currentSession]);

  return {
    isRunning: isTimerRunning,
    session: currentSession,
    start: startSession,
    end: endSession,
    formatDuration,
    getSessionDuration
  };
}
