import { motion } from 'framer-motion';
import type { Issue } from '../types';
import { useCardAction } from '../hooks/useCardAction';
import { getCompanyId } from '../services/paperclip';

interface Props {
  issues: Issue[];
  onRefresh: () => void;
  newIssueIds?: Set<string>;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ff4444',
  high: '#ff8800',
  medium: '#00d4ff',
  low: '#2a5f80',
};

function companyLabel(identifier: string): string {
  return identifier.split('-')[0] ?? '';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function BlockedCard({ issue, onRefresh, isNew, index }: {
  issue: Issue; onRefresh: () => void; isNew: boolean; index: number;
}) {
  const cid = issue.companyId ?? getCompanyId();
  const { execute, isPending, didSucceed } = useCardAction(issue.id, cid, onRefresh);
  const shouldPulse = didSucceed || isNew;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: shouldPulse ? '0 0 12px rgba(0,212,255,0.6)' : '0 0 0px rgba(0,212,255,0)',
      }}
      transition={{
        opacity: { delay: index * 0.08, duration: 0.3 },
        y: { delay: index * 0.08, duration: 0.3 },
        boxShadow: { duration: 1, ease: 'easeOut' },
      }}
      className="rounded p-2"
      style={{ background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.15)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono" style={{ color: '#ff4444', opacity: 0.7 }}>
            {issue.identifier}
          </span>
          <span
            className="text-xs px-1 rounded"
            style={{ color: '#ff444488', background: 'rgba(255,68,68,0.1)', fontSize: '8px', letterSpacing: '0.05em' }}
          >
            {companyLabel(issue.identifier)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => execute('patch_issue', { status: 'in_progress' })}
            disabled={isPending}
            className="font-mono tracking-widest opacity-40 hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded disabled:cursor-not-allowed"
            style={{ color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)', fontSize: '9px' }}
          >
            UNBLOCK
          </button>
          <button
            onClick={() => execute('patch_issue', { assigneeAgentId: null })}
            disabled={isPending}
            className="font-mono tracking-widest opacity-40 hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded disabled:cursor-not-allowed"
            style={{ color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)', fontSize: '9px' }}
          >
            REASSIGN
          </button>
          <span
            className="tracking-wider px-1.5 py-0.5 rounded"
            style={{
              color: PRIORITY_COLORS[issue.priority] ?? '#2a5f80',
              background: `${PRIORITY_COLORS[issue.priority] ?? '#2a5f80'}11`,
              border: `1px solid ${PRIORITY_COLORS[issue.priority] ?? '#2a5f80'}44`,
              fontSize: '9px',
            }}
          >
            {issue.priority.toUpperCase()}
          </span>
          <span className="text-xs text-jarvis-dim">{timeAgo(issue.updatedAt)}</span>
        </div>
      </div>
      <div className="text-xs leading-tight" style={{ color: '#9f7f7f' }}>
        {issue.title}
      </div>
    </motion.div>
  );
}

export function BlockedPanel({ issues, onRefresh, newIssueIds }: Props) {
  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest" style={{ color: '#ff4444' }}>BLOCKED</span>
        <span className="text-xs text-jarvis-dim">{issues.length} ITEMS</span>
      </div>
      <div className="glow-line" style={{ background: 'rgba(255,68,68,0.3)' }} />
      <div className="flex-1 overflow-y-auto space-y-2 mt-2">
        {issues.length === 0 && (
          <div className="text-xs text-jarvis-dim text-center py-4">NO BLOCKERS</div>
        )}
        {issues.map((issue, i) => (
          <BlockedCard
            key={issue.id}
            issue={issue}
            onRefresh={onRefresh}
            isNew={newIssueIds?.has(issue.id) ?? false}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
