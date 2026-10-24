'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
const WARNING_BEFORE = 5 * 60 * 1000;

export interface SessionTimeoutState {
  showWarning: boolean;
  remainingSeconds: number;
  extendSession: () => void;
}

export function useSessionTimeout(onLogout: () => void): SessionTimeoutState {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showWarningRef = useRef(false);

  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    timeoutRef.current = null;
    warningRef.current = null;
    countdownRef.current = null;
  }, []);

  const resetTimer = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(WARNING_BEFORE / 1000);
      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);

    timeoutRef.current = setTimeout(() => {
      onLogout();
    }, INACTIVITY_TIMEOUT);
  }, [clearAllTimers, onLogout]);

  useEffect(() => {
    const events = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'] as const;

    const handleActivity = () => {
      if (!showWarningRef.current) resetTimer();
    };

    for (const event of events) window.addEventListener(event, handleActivity);
    // § setTimeout 0 — setState ของ resetTimer ต้องอยู่ใน callback (rule react-hooks/set-state-in-effect)
    const initTimer = setTimeout(resetTimer, 0);

    return () => {
      clearTimeout(initTimer);
      for (const event of events) window.removeEventListener(event, handleActivity);
      clearAllTimers();
    };
  }, [resetTimer, clearAllTimers]);

  const extendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  return { showWarning, remainingSeconds, extendSession };
}
