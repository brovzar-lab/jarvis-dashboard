import { motion } from 'framer-motion';
import type { Issue } from '../types';

interface Props {
  issues: Issue[];
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

export function AgendaPanel({ issues }: Props) {
  const sorted = [...issues].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-jarvis">TODAY'S AGENDA</span>
        <span className="text-xs text-jarvis-dim">{sorted.length} TASKS</span>
      </div>
      <div className="glow-line" />
      <div className="flex-1 overflow-y-auto space-y-2 mt-2">
        {sorted.length === 0 && (
          <div className="text-xs text-jarvis-dim text-center py-4">NO ACTIVE TASKS</div>
        )}
        {sorted.map((issue, i) => (
          <motion.div
            key={issue.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
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
          </motion.div>
        ))}
      </div>
    </div>
  );
}
