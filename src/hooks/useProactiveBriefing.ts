import { useEffect, useRef, useState, useCallback } from 'react';
import type { DashboardData } from '../types';
import { stopSpeaking } from '../services/tts';

const SESSION_KEY = 'jarvis_briefed';

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function buildBriefing(data: DashboardData): string {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const agentCount = data.agents.length;
  const blockedCount = data.blockedIssues.length;
  const waitingCount = data.waitingOnMeIssues.length;
  const topItem = data.myInbox[0] ?? data.activeIssues[0];

  let brief = `Good ${getGreeting()} sir. It's ${weekday}, ${date}.`;
  brief += ` You have ${agentCount} agent${agentCount !== 1 ? 's' : ''}.`;

  if (blockedCount > 0) {
    brief += ` ${blockedCount} issue${blockedCount !== 1 ? 's' : ''} ${blockedCount !== 1 ? 'are' : 'is'} blocked`;
    if (waitingCount > 0) {
      brief += ` — ${waitingCount} waiting on your decision`;
    }
    brief += '.';
  }

  if (topItem) {
    brief += ` Your highest-priority open item is ${topItem.identifier}.`;
  }

  return brief;
}

export function useProactiveBriefing(
  dashboardData: DashboardData | undefined,
  _hasExistingHistory: boolean,
  onBriefing: (text: string) => Promise<void>,
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

    // Always deliver the full morning brief — no "Welcome back" fallback
    const text = buildBriefing(dashboardData);

    const fireBriefing = () => {
      setIsBriefing(true);
      onBriefingRef.current(text).finally(() => setIsBriefing(false));
    };

    // Desktop and mobile: fire 3s after dashboard data is ready.
    // Mic permission is pre-warmed by App.tsx before music starts, so audio is
    // already unblocked by the time this fires.
    const timer = setTimeout(fireBriefing, 3000);
    return () => clearTimeout(timer);
  }, [dashboardData]);

  return { isBriefing, skipBriefing };
}
