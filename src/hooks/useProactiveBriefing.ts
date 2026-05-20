import { useEffect, useRef, useState, useCallback } from 'react';
import type { DashboardData } from '../types';
import { stopSpeaking } from '../services/tts';

const SESSION_KEY = 'jarvis_briefed';

function todayKey(): string {
  return new Date().toLocaleDateString('sv');
}

export function useProactiveBriefing(
  dashboardData: DashboardData | undefined,
  _hasExistingHistory: boolean,
  enabled: boolean,
  onBriefing: () => Promise<void>,
): { isBriefing: boolean; skipBriefing: () => void; fireBriefingNow: () => boolean } {
  const calledRef = useRef(false);
  const onBriefingRef = useRef(onBriefing);
  onBriefingRef.current = onBriefing;
  const [isBriefing, setIsBriefing] = useState(false);

  const skipBriefing = useCallback(() => {
    stopSpeaking();
    setIsBriefing(false);
  }, []);

  // Called directly from the compliment callback for a zero-gap seamless handoff.
  // Returns true if the briefing was fired, false if it was already done or data not ready.
  const fireBriefingNow = useCallback((): boolean => {
    if (calledRef.current) return false;
    if (sessionStorage.getItem(SESSION_KEY) === todayKey()) return false;
    if (!dashboardData) return false;

    calledRef.current = true;
    sessionStorage.setItem(SESSION_KEY, todayKey());

    setIsBriefing(true);
    onBriefingRef.current().finally(() => setIsBriefing(false));
    return true;
  }, [dashboardData]);

  // Fallback path: fires when enabled flips true without a direct fireBriefingNow call
  // (e.g. compliment was skipped, or no compliment on a revisit within the same day).
  useEffect(() => {
    if (!enabled) return;
    if (calledRef.current) return;
    if (sessionStorage.getItem(SESSION_KEY) === todayKey()) return;
    if (!dashboardData) return;

    calledRef.current = true;
    sessionStorage.setItem(SESSION_KEY, todayKey());

    const fireBriefing = () => {
      setIsBriefing(true);
      onBriefingRef.current().finally(() => setIsBriefing(false));
    };

    const timer = setTimeout(fireBriefing, 500);
    return () => clearTimeout(timer);
  }, [dashboardData, enabled]);

  return { isBriefing, skipBriefing, fireBriefingNow };
}
