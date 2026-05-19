import { useState } from 'react';
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function WaitingCard({ issue, onRefresh, isNew, index }: {
  issue: Issue; onRefresh: () => void; isNew: boolean; index: number;
}) {
  const cid = issue.companyId ?? getCompanyId();
  const { execute, isPending, didSucceed, didFail, errorMsg } = useCardAction(issue.id, cid, onRefresh);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const shouldPulse = didSucceed || isNew;

  const handleComment = async () => {
    if (!commentText.trim()) return;
    await execute('add_comment', { body: commentText.trim() });
    setCommentText('');
    setCommentOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: didFail
          ? '0 0 10px rgba(255,68,68,0.5)'
          : shouldPulse
          ? '0 0 12px rgba(0,212,255,0.6)'
          : '0 0 0px rgba(0,212,255,0)',
      }}
      transition={{
        opacity: { delay: index * 0.08, duration: 0.3 },
        y: { delay: index * 0.08, duration: 0.3 },
        boxShadow: { duration: 1, ease: 'easeOut' },
      }}
      className="rounded p-2"
      style={{ background: 'rgba(255,136,0,0.04)', border: `1px solid ${didFail ? 'rgba(255,68,68,0.4)' : 'rgba(255,136,0,0.15)'}` }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-mono" style={{ color: '#ff8800', opacity: 0.8 }}>
          {issue.identifier}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => execute('patch_issue', { status: 'done' })}
            disabled={isPending}
            className="font-mono tracking-widest opacity-40 hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded disabled:cursor-not-allowed"
            style={{ color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)', fontSize: '9px' }}
          >
            APPROVE
          </button>
          <button
            onClick={() => execute('patch_issue', { assigneeAgentId: null })}
            disabled={isPending}
            className="font-mono tracking-widest opacity-40 hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded disabled:cursor-not-allowed"
            style={{ color: '#ff8800', border: '1px solid rgba(255,136,0,0.3)', fontSize: '9px' }}
          >
            DELEGATE
          </button>
          <button
            onClick={() => setCommentOpen(o => !o)}
            disabled={isPending}
            className="font-mono tracking-widest opacity-40 hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded disabled:cursor-not-allowed"
            style={{ color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)', fontSize: '9px' }}
          >
            COMMENT
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
      <div className="text-xs leading-tight" style={{ color: '#9f8f7f' }}>
        {issue.title}
      </div>
      {didFail && errorMsg && (
        <div className="mt-1 text-xs" style={{ color: '#ff4444', fontSize: '0.6rem' }}>
          ⚠ {errorMsg}
        </div>
      )}
      {commentOpen && (
        <div className="mt-2 flex flex-col gap-1">
          <textarea
            autoFocus
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setCommentOpen(false); }}
            placeholder="Add comment... (Shift+Enter for new line)"
            rows={3}
            className="w-full text-xs font-mono px-2 py-1.5 rounded outline-none resize-none"
            style={{
              background: 'rgba(0,212,255,0.05)',
              border: '1px solid rgba(0,212,255,0.2)',
              color: '#00d4ff',
            }}
          />
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => setCommentOpen(false)}
              className="font-mono tracking-widest px-2 py-0.5 rounded text-xs opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: '#2a5f80', border: '1px solid rgba(42,95,128,0.3)', fontSize: '9px' }}
            >
              CANCEL
            </button>
            <button
              onClick={handleComment}
              disabled={isPending || !commentText.trim()}
              className="font-mono tracking-widest px-2 py-0.5 rounded text-xs opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30"
              style={{ color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)', fontSize: '9px' }}
            >
              SEND
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function WaitingOnMePanel({ issues, onRefresh, newIssueIds }: Props) {
  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest" style={{ color: '#ff8800' }}>YOUR CALL</span>
        <span className="text-xs text-jarvis-dim">{issues.length} WAITING</span>
      </div>
      <div className="glow-line" style={{ background: 'rgba(255,136,0,0.3)' }} />
      <div className="flex-1 overflow-y-auto space-y-2 mt-2">
        {issues.length === 0 && (
          <div className="text-xs text-jarvis-dim text-center py-4">NOTHING AWAITING YOUR DECISION</div>
        )}
        {issues.map((issue, i) => (
          <WaitingCard
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
