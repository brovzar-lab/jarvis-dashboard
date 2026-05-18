import type { DashboardData } from '../types';

interface Props {
  data: DashboardData;
  lastUpdated: Date;
  sessionCost: number;
}

export function MetricsBar({ data, lastUpdated, sessionCost }: Props) {
  const activeAgents = data.agents.filter(a => a.status === 'in_progress' || a.status === 'busy').length;
  const inProgressCount = data.myInbox.filter(i => i.status === 'in_progress').length;
  const costStr = sessionCost === 0 ? '$0.0000' : `$${sessionCost.toFixed(4)}`;

  return (
    <div
      className="flex items-center gap-4 md:gap-6 px-3 md:px-6 py-2 text-xs overflow-x-auto"
      style={{ borderBottom: '1px solid rgba(0,212,255,0.08)', background: 'rgba(0,212,255,0.02)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-jarvis-dim">AGENTS ACTIVE</span>
        <span className="text-jarvis font-bold">{activeAgents}/{data.agents.length}</span>
      </div>
      <div className="h-3 w-px" style={{ background: '#0a2a4a' }} />
      <div className="flex items-center gap-2">
        <span className="text-jarvis-dim">REVIEWS PENDING</span>
        <span className="font-bold" style={{ color: data.inReviewIssues.length > 0 ? '#ff8800' : '#2a5f80' }}>
          {data.inReviewIssues.length}
        </span>
      </div>
      <div className="h-3 w-px" style={{ background: '#0a2a4a' }} />
      <div className="flex items-center gap-2">
        <span className="text-jarvis-dim">IN PROGRESS</span>
        <span className="text-jarvis font-bold">{inProgressCount}</span>
      </div>
      {data.blockedIssues.length > 0 && (
        <>
          <div className="h-3 w-px" style={{ background: '#0a2a4a' }} />
          <div className="flex items-center gap-2">
            <span className="text-jarvis-dim">BLOCKED</span>
            <span className="font-bold" style={{ color: '#ff4444' }}>{data.blockedIssues.length}</span>
          </div>
        </>
      )}
      {data.waitingOnMeIssues.length > 0 && (
        <>
          <div className="h-3 w-px" style={{ background: '#0a2a4a' }} />
          <div className="flex items-center gap-2">
            <span className="text-jarvis-dim">YOUR CALL</span>
            <span className="font-bold" style={{ color: '#ff8800' }}>{data.waitingOnMeIssues.length}</span>
          </div>
        </>
      )}
      <div className="h-3 w-px" style={{ background: '#0a2a4a' }} />
      <div className="flex items-center gap-2">
        <span className="text-jarvis-dim">SESSION COST</span>
        <span className="font-mono font-bold" style={{ color: sessionCost > 0.01 ? '#ff8800' : '#2a5f80' }}>{costStr}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-jarvis-dim">LAST SYNC</span>
        <span style={{ color: '#2a5f80' }}>
          {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
