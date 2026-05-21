import { useEffect, useRef, useState, useCallback } from 'react';
import type { DashboardData } from '../types';
import { stopSpeaking } from '../services/tts';

export function useProactiveBriefing(
  dashboardData: DashboardData | undefined,
  _hasExistingHistory: boolean,
  enabled: boolean,
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
    if (!enabled) return;
    if (calledRef.current) return;
    if (!dashboardData) return;

    calledRef.current = true;

    setIsBriefing(true);
    onBriefingRef.current().finally(() => setIsBriefing(false));
  }, [dashboardData, enabled]);

  return { isBriefing, skipBriefing };
}
