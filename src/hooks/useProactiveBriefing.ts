import { useEffect, useRef } from 'react';
import type { DashboardData } from '../types';

const SESSION_KEY = 'jarvis_briefed';

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
  hasExistingHistory: boolean,
  onBriefing: (text: string) => void,
): void {
  const calledRef = useRef(false);
  const onBriefingRef = useRef(onBriefing);
  onBriefingRef.current = onBriefing;

  useEffect(() => {
    if (calledRef.current) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (!dashboardData) return;

    calledRef.current = true;
    sessionStorage.setItem(SESSION_KEY, 'true');

    const text = hasExistingHistory
      ? 'Welcome back, sir. Picking up where we left off.'
      : buildBriefing(dashboardData);

    const timer = setTimeout(() => {
      onBriefingRef.current(text);
    }, 2000);

    return () => clearTimeout(timer);
  }, [dashboardData, hasExistingHistory]);
}
