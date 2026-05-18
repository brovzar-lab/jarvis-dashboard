import { motion } from 'framer-motion';
import type { Issue } from '../types';

interface Props {
  blocked: Issue[];
  review: Issue[];
  waiting: Issue[];
  onAction: (text: string) => void;
}

const CARD_CONFIG = [
  {
    key: 'resolve' as const,
    label: 'RESOLVE',
    accent: '#ef4444',
    dim: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    getIssue: (p: Props) => p.blocked[0],
    query: (id: string) => `What's blocking ${id} and how do I unblock it?`,
    buttons: ['RESOLVE', 'ASSIGN OPERATOR'],
    secondaryQuery: (id: string) => `Who should handle unblocking ${id}?`,
  },
  {
    key: 'review' as const,
    label: 'REVIEW',
    accent: '#fbbf24',
    dim: 'rgba(251,191,36,0.06)',
    border: 'rgba(251,191,36,0.25)',
    getIssue: (p: Props) => p.review[0],
    query: (id: string) => `Summarize ${id} so I can decide whether to approve it`,
    buttons: ['APPROVE', 'REQUEST CHANGES'],
    secondaryQuery: (id: string) => `What changes should be requested for ${id}?`,
  },
  {
    key: 'waiting' as const,
    label: 'YOUR CALL',
    accent: '#a78bfa',
    dim: 'rgba(167,139,250,0.06)',
    border: 'rgba(167,139,250,0.25)',
    getIssue: (p: Props) => p.waiting[0],
    query: (id: string) => `What's the best next action for ${id}?`,
    buttons: ['DECIDE', 'DELEGATE'],
    secondaryQuery: (id: string) => `Who should I delegate ${id} to?`,
  },
];

export function SuggestedMovesStrip({ blocked, review, waiting, onAction }: Props) {
  const cards = CARD_CONFIG
    .map(cfg => ({ cfg, issue: cfg.getIssue({ blocked, review, waiting, onAction }) }))
    .filter(c => c.issue != null);

  if (cards.length === 0) return null;

  return (
    <div
      className="flex-shrink-0 px-3 md:px-4 pb-3"
      style={{ borderTop: '1px solid rgba(0,212,255,0.07)' }}
    >
      <div className="flex items-center gap-3 py-2">
        <motion.span
          className="text-xs tracking-widest"
          style={{ color: '#00d4ff', fontSize: '0.6rem' }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          ◆ SUGGESTED NEXT MOVES
        </motion.span>
        <span className="text-xs tracking-widest" style={{ color: '#1a3040', fontSize: '0.55rem' }}>
          JARVIS · {cards.length} action{cards.length > 1 ? 's' : ''} surfaced
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map(({ cfg, issue }) => (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="panel-border rounded p-3"
            style={{ background: cfg.dim, borderColor: cfg.border }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs tracking-widest font-bold" style={{ color: cfg.accent, fontSize: '0.6rem' }}>
                {cfg.label}
              </span>
              <span
                className="text-xs tracking-widest px-1.5 py-0.5 rounded"
                style={{ color: cfg.accent, background: cfg.dim, border: '1px solid ' + cfg.border, fontSize: '0.55rem' }}
              >
                {issue!.priority.toUpperCase()}
              </span>
            </div>
            <div className="text-xs font-mono mb-0.5" style={{ color: cfg.accent, fontSize: '0.6rem' }}>
              {issue!.identifier}
            </div>
            <div
              className="text-xs mb-2.5 leading-relaxed"
              style={{ color: '#4a9fc0', fontSize: '0.7rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {issue!.title}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onAction(cfg.query(issue!.identifier))}
                className="flex-1 py-1 text-xs tracking-widest transition-all hover:opacity-80"
                style={{ border: '1px solid ' + cfg.border, color: cfg.accent, background: 'transparent', fontSize: '0.55rem' }}
              >
                {cfg.buttons[0]}
              </button>
              <button
                onClick={() => onAction(cfg.secondaryQuery(issue!.identifier))}
                className="flex-1 py-1 text-xs tracking-widest transition-all hover:opacity-80"
                style={{ border: '1px solid rgba(0,212,255,0.15)', color: '#2a5f80', background: 'transparent', fontSize: '0.55rem' }}
              >
                {cfg.buttons[1]}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
