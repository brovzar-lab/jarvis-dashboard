import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Issue } from '../types';

interface Props {
  issues: Issue[];
  onHearPitch?: (issue: Issue) => void;
  playingPitchId?: string | null;
}

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

const STATUS_COLORS: Record<string, string> = {
  in_progress: '#00d4ff',
  todo: '#2a5f80',
  in_review: '#ff8800',
  blocked: '#ff4444',
};

export function PitchesPanel({ issues, onHearPitch, playingPitchId }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-jarvis">LEMA PITCHES</span>
        <span className="text-xs text-jarvis-dim">{issues.length} ACTIVE</span>
      </div>
      <div className="glow-line" />
      <div className="flex-1 overflow-y-auto space-y-2 mt-2">
        {issues.length === 0 && (
          <div className="text-xs text-jarvis-dim text-center py-4">NO ACTIVE PITCHES</div>
        )}
        {issues.map((issue, i) => {
          const isPlaying = playingPitchId === issue.id;
          return (
            <motion.div
              key={issue.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              onMouseEnter={() => setHoverId(issue.id)}
              onMouseLeave={() => setHoverId(null)}
              className="rounded p-2"
              style={{
                background: isPlaying ? 'rgba(0,212,255,0.07)' : 'rgba(0,212,255,0.03)',
                border: `1px solid ${isPlaying ? 'rgba(0,212,255,0.35)' : 'rgba(0,212,255,0.1)'}`,
                transition: 'all 0.2s',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-mono" style={{ color: '#00d4ff', opacity: 0.7, fontSize: '10px' }}>
                  {issue.identifier}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      color: STATUS_COLORS[issue.status] ?? '#2a5f80',
                      fontSize: '9px',
                    }}
                  >
                    {STATUS_LABELS[issue.status] ?? issue.status.toUpperCase()}
                  </span>
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
                </div>
              </div>
              <div className="text-xs leading-snug mb-1.5" style={{ color: '#5a9fbf' }}>
                {issue.title}
              </div>
              {onHearPitch && (hoverId === issue.id || isPlaying) && (
                <button
                  onClick={() => onHearPitch(issue)}
                  disabled={isPlaying}
                  className="font-mono tracking-widest px-2 py-0.5 rounded transition-opacity"
                  style={{
                    color: isPlaying ? '#34d399' : '#00d4ff',
                    border: `1px solid ${isPlaying ? 'rgba(52,211,153,0.4)' : 'rgba(0,212,255,0.3)'}`,
                    fontSize: '9px',
                    opacity: isPlaying ? 1 : 0.7,
                  }}
                >
                  {isPlaying ? (
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      ▶ PLAYING...
                    </motion.span>
                  ) : '▶ HEAR PITCH'}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
