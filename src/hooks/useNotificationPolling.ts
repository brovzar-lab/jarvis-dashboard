import { useEffect, useRef } from 'react';
import type { DashboardData } from '../types';

export function useNotificationPolling(
  dashboardData: DashboardData | undefined,
  onAudioAlert: (message: string) => void,
  onVisualAlert: (message: string) => void,
  getLastActivity: () => number,
): void {
  const prevRef = useRef<DashboardData | null>(null);
  const onAudioAlertRef = useRef(onAudioAlert);
  const onVisualAlertRef = useRef(onVisualAlert);
  const getLastActivityRef = useRef(getLastActivity);
  onAudioAlertRef.current = onAudioAlert;
  onVisualAlertRef.current = onVisualAlert;
  getLastActivityRef.current = getLastActivity;

  useEffect(() => {
    if (!dashboardData) return;

    const prev = prevRef.current;
    prevRef.current = dashboardData;

    // First load — set baseline, no announcements
    if (!prev) return;

    // Build set of all issue ids currently visible in any list
    const currentIds = new Set([
      ...dashboardData.activeIssues.map(i => i.id),
      ...dashboardData.inReviewIssues.map(i => i.id),
      ...dashboardData.blockedIssues.map(i => i.id),
      ...dashboardData.waitingOnMeIssues.map(i => i.id),
      ...dashboardData.myInbox.map(i => i.id),
    ]);

    // Previous waitingOnMe ids — for blocked escalation detection
    const prevWaitingIds = new Set(prev.waitingOnMeIssues.map(i => i.id));

    // Agent name lookup from previous snapshot
    const agentMap = new Map(prev.agents.map(a => [a.id, a.name]));

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const userIsActive = getLastActivityRef.current() > fiveMinutesAgo;

    const audioAnnouncements: string[] = [];
    const visualAnnouncements: string[] = [];

    // Issues that were active (in_progress) and have now disappeared → completed
    for (const issue of prev.activeIssues) {
      if (!currentIds.has(issue.id)) {
        const agentName = issue.assigneeAgentId ? agentMap.get(issue.assigneeAgentId) : undefined;
        const message = `Sir, ${agentName ?? 'an agent'} has completed ${issue.title}.`;

        if (issue.priority === 'critical') {
          // Critical: audio if user is active, visual-only if not
          if (userIsActive) {
            audioAnnouncements.push(message);
          } else {
            visualAnnouncements.push(message);
          }
        } else if (issue.priority === 'high') {
          // High: visual badge only — never auto-speech
          visualAnnouncements.push(message);
        }
      }
    }

    // Issues that were waiting on me and are now blocked — always audio (requires user action)
    for (const issue of dashboardData.blockedIssues) {
      if (prevWaitingIds.has(issue.id)) {
        audioAnnouncements.push(`Sir, ${issue.identifier} is now blocked and awaiting your decision.`);
      }
    }

    // Rate limit: 1 audio announcement per refresh cycle
    if (audioAnnouncements.length > 0) {
      onAudioAlertRef.current(audioAnnouncements[0]);
    }

    // Fire all visual alerts (lightweight badge updates)
    for (const msg of visualAnnouncements) {
      onVisualAlertRef.current(msg);
    }
  }, [dashboardData]);
}
