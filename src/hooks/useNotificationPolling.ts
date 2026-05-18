import { useEffect, useRef } from 'react';
import type { DashboardData } from '../types';

export function useNotificationPolling(
  dashboardData: DashboardData | undefined,
  onNotification: (message: string) => void,
): void {
  const prevRef = useRef<DashboardData | null>(null);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

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

    const announcements: string[] = [];

    // Issues that were active (in_progress) and have now disappeared → completed
    for (const issue of prev.activeIssues) {
      if (
        !currentIds.has(issue.id) &&
        (issue.priority === 'critical' || issue.priority === 'high')
      ) {
        const agentName = issue.assigneeAgentId ? agentMap.get(issue.assigneeAgentId) : undefined;
        announcements.push(`Sir, ${agentName ?? 'an agent'} has completed ${issue.title}.`);
      }
    }

    // Issues that were waiting on me and are now blocked
    for (const issue of dashboardData.blockedIssues) {
      if (prevWaitingIds.has(issue.id)) {
        announcements.push(`Sir, ${issue.identifier} is now blocked and awaiting your decision.`);
      }
    }

    // Rate limit: 1 announcement per refresh cycle
    if (announcements.length > 0) {
      onNotificationRef.current(announcements[0]);
    }
  }, [dashboardData]);
}
