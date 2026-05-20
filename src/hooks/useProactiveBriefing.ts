import { useEffect, useRef, useState, useCallback } from 'react';
import type { DashboardData } from '../types';
import { stopSpeaking } from '../services/tts';

const SESSION_KEY = 'jarvis_briefed';

export function useProactiveBriefing(
  dashboardData: DashboardData | undefined,
  _hasExistingHistory: boolean,
  onBriefing: () => Promise<void>,
): { isBriefing: boolean; skipBriefing: () => void } {
  const calledRef = useRef(false);
  const onBriefingRef = useRef(onBriefing);
  onBriefingRef.current = onBriefing;
  const [isBriefing, setIsBriefing] = useState(false);

  const skipBriefing = useCallback(() => {
    stopSpeaking();
    setIsBriefing(false);
  }, []);

  useEffect(() => {
    if (calledRef.current) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (!dashboardData) return;

    calledRef.current = true;
    sessionStorage.setItem(SESSION_KEY, 'true');

    const fireBriefing = () => {
      setIsBriefing(true);
      onBriefingRef.current().finally(() => setIsBriefing(false));
    };

    const timer = setTimeout(fireBriefing, 3000);
    return () => clearTimeout(timer);
  }, [dashboardData]);

  return { isBriefing, skipBriefing };
}
