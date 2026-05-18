import { useState, useEffect } from 'react';
import type { DashboardData } from '../types';

interface Props {
  data: DashboardData;
  lastUpdated: Date;
  sessionCost: number;
  visualAlerts?: string[];
  onDismissAlerts?: () => void;
}

export function MetricsBar({ data, lastUpdated, sessionCost, visualAlerts = [], onDismissAlerts }: Props) {
  const [showAlerts, setShowAlerts] = useState(false);
  const [secsAgo, setSecsAgo] = useState(() => Math.floor((Date.now() - lastUpdated.getTime()) / 1000));

  useEffect(() => {
    const update = () => setSecsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, [lastUpdated]);
  const activeAgents = data.agents.filter(a => a.status === 'in_progress' || a.status === 'busy').length;
  const inProgressCount = data.myInbox.filter(i => i.status === 'in_progress').length;
  const costStr = sessionCost === 0 ? '$0.0000' : `$${sessionCost.toFixed(4)}`;

  const handleDismissAll = () => {
    onDismissAlerts?.();
    setShowAlerts(false);
  };

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
      {visualAlerts.length > 0 && (
        <>
          <div className="h-3 w-px" style={{ background: '#0a2a4a' }} />
          <div className="relative">
            <button
              onClick={() => setShowAlerts(s => !s)}
              className="flex items-center gap-2"
            >
              <span className="text-jarvis-dim">ALERTS</span>
              <span className="font-bold animate-pulse" style={{ color: '#ff8800' }}>
                {visualAlerts.length}
              </span>
            </button>
            {showAlerts && (
              <div
                className="absolute bottom-full mb-2 right-0 z-50 min-w-[260px] max-w-[380px]"
                style={{ background: '#020b18', border: '1px solid rgba(255,136,0,0.4)', borderRadius: 4 }}
              >
                <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                  {visualAlerts.map((alert, i) => (
                    <div
                      key={i}
                      className="text-xs p-2"
                      style={{ color: '#ff8800', borderBottom: i < visualAlerts.length - 1 ? '1px solid rgba(255,136,0,0.15)' : undefined }}
                    >
                      {alert}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleDismissAll}
                  className="w-full p-2 text-xs tracking-widest text-center transition-colors hover:bg-white/5"
                  style={{ color: '#2a5f80', borderTop: '1px solid rgba(0,212,255,0.1)' }}
                >
                  DISMISS ALL
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-jarvis-dim">LAST SYNC</span>
        <span style={{ color: '#2a5f80' }}>
          {secsAgo < 60 ? `${secsAgo}s AGO` : `${Math.floor(secsAgo / 60)}m AGO`}
        </span>
      </div>
    </div>
  );
}
