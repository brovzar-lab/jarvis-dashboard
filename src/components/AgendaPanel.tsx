import { motion } from 'framer-motion';
import type { Issue } from '../types';
import { useCardAction } from '../hooks/useCardAction';
import { getCompanyId } from '../services/paperclip';

interface Props {
  issues: Issue[];
  onRefresh: () => void;
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ff4444',
  high: '#ff8800',
  medium: '#00d4ff',
  low: '#2a5f80',
};
const STATUS_LABELS: Record<string, string> = {
  in_progress: 'IN PROGRESS',
  todo: 'TODO',
  in_review: 'IN REVIEW',
  blocked: 'BLOCKED',
};

// Filter out APPU issues to reduce noise; keep only LEMA and other non-internal items,
// plus any critical/high APPU items so nothing truly urgent is hidden
function filterAgenda(issues: Issue[]): Issue[] {
  return issues.filter(i => {
    const isAppu = /^APPU-/i.test(i.identifier ?? '');
    if (!isAppu) return true;
    return i.priority === 'critical' || i.priority === 'high';
  });
}

function AgendaItem({ issue, onRefresh, index }: {
  issue: Issue; onRefresh: () => void; index: number;
}) {
  const cid = issue.companyId ?? getCompanyId();
  const { execute, isPending, didSucceed, didFail } = useCardAction(issue.id, cid, onRefresh);

  return (
    <motion.div
      key={issue.id}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-start gap-3 py-1.5"
      style={{ borderBottom: '1px solid rgba(0,212,255,0.05)' }}
    >
      <div
        className="w-1 rounded-full flex-shrink-0 mt-1"
        style={{
          height: 24,
          background: PRIORITY_COLORS[issue.priority] ?? '#2a5f80',
          boxShadow: `0 0 6px ${PRIORITY_COLORS[issue.priority] ?? '#2a5f80'}`,
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono" style={{ color: '#00d4ff', opacity: 0.6, fontSize: '10px' }}>
            {issue.identifier}
          </span>
          <span
            className="text-xs tracking-wider"
            style={{ color: STATUS_LABELS[issue.status] === 'BLOCKED' ? '#ff4444' : '#2a5f80', fontSize: '9px' }}
          >
            {STATUS_LABELS[issue.status] ?? issue.status.toUpperCase()}
          </span>
        </div>
        <div className="text-xs leading-snug" style={{ color: '#5a9fbf' }}>
          {issue.title}
        </div>
      </div>
      <button
        onClick={() => execute('patch_issue', { status: 'done' })}
        disabled={isPending}
        title="Mark done"
        className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded opacity-20 hover:opacity-80 transition-opacity disabled:cursor-not-allowed mt-0.5"
        style={{
          border: `1px solid ${didFail ? 'rgba(255,68,68,0.5)' : didSucceed ? 'rgba(0,255,136,0.5)' : 'rgba(0,212,255,0.25)'}`,
          color: didFail ? '#ff4444' : didSucceed ? '#00ff88' : '#00d4ff',
          fontSize: '9px',
        }}
      >
        ✓
      </button>
    </motion.div>
  );
}

export function AgendaPanel({ issues, onRefresh }: Props) {
  const filtered = filterAgenda(issues);
  const sorted = [...filtered].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );
  const hiddenCount = issues.length - filtered.length;

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-jarvis">TODAY'S AGENDA</span>
        <div className="flex items-center gap-2">
          {hiddenCount > 0 && (
            <span className="text-xs text-jarvis-dim" style={{ fontSize: '0.55rem' }}>
              +{hiddenCount} APPU hidden
            </span>
          )}
          <span className="text-xs text-jarvis-dim">{sorted.length} TASKS</span>
        </div>
      </div>
      <div className="glow-line" />
      <div className="flex-1 overflow-y-auto space-y-2 mt-2">
        {sorted.length === 0 && (
          <div className="text-xs text-jarvis-dim text-center py-4">NO ACTIVE TASKS</div>
        )}
        {sorted.map((issue, i) => (
          <AgendaItem key={issue.id} issue={issue} onRefresh={onRefresh} index={i} />
        ))}
      </div>
    </div>
  );
}
