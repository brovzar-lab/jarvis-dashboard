import { useState } from 'react';
import type { Issue } from '../types';
import { ReviewCard } from './ReviewPanel';
import { BlockedCard } from './BlockedPanel';
import { WaitingCard } from './WaitingOnMePanel';

type Tab = 'review' | 'blocked' | 'waiting';

interface Props {
  reviewIssues: Issue[];
  blockedIssues: Issue[];
  waitingIssues: Issue[];
  onRefresh: () => void;
  newIssueIds: Set<string>;
}

export function RightIssuesTabs({ reviewIssues, blockedIssues, waitingIssues, onRefresh, newIssueIds }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('review');

  const tabs: Array<{ id: Tab; label: string; count: number; color: string }> = [
    { id: 'review',  label: 'PENDING REVIEW', count: reviewIssues.length,  color: '#00d4ff' },
    { id: 'blocked', label: 'BLOCKED',         count: blockedIssues.length, color: '#ff4444' },
    { id: 'waiting', label: 'YOUR CALL',        count: waitingIssues.length, color: '#ff8800' },
  ];

  return (
    <div className="panel-border corner-decoration rounded h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.1)' }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-1.5 px-1 tracking-widest transition-colors"
            style={{
              fontSize: '0.45rem',
              color: activeTab === tab.id ? tab.color : '#1a3040',
              background: activeTab === tab.id ? `${tab.color}0d` : 'transparent',
              borderBottom: activeTab === tab.id ? `1px solid ${tab.color}` : '1px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{ marginLeft: 3, opacity: 0.7 }}>· {tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {activeTab === 'review' && (
          reviewIssues.length === 0 ? (
            <div className="text-xs text-jarvis-dim text-center py-4 tracking-widest">QUEUE CLEAR</div>
          ) : (
            <div className="space-y-2">
              {reviewIssues.map((issue, i) => (
                <ReviewCard
                  key={issue.id}
                  issue={issue}
                  onRefresh={onRefresh}
                  isNew={newIssueIds.has(issue.id)}
                  index={i}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'blocked' && (
          blockedIssues.length === 0 ? (
            <div className="text-xs text-jarvis-dim text-center py-4 tracking-widest">NO BLOCKERS</div>
          ) : (
            <div className="space-y-2">
              {blockedIssues.map((issue, i) => (
                <BlockedCard
                  key={issue.id}
                  issue={issue}
                  onRefresh={onRefresh}
                  isNew={newIssueIds.has(issue.id)}
                  index={i}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'waiting' && (
          waitingIssues.length === 0 ? (
            <div className="text-xs text-jarvis-dim text-center py-4 tracking-widest">NOTHING AWAITING YOUR DECISION</div>
          ) : (
            <div className="space-y-2">
              {waitingIssues.map((issue, i) => (
                <WaitingCard
                  key={issue.id}
                  issue={issue}
                  onRefresh={onRefresh}
                  isNew={newIssueIds.has(issue.id)}
                  index={i}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
