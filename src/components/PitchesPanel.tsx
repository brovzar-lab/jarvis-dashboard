import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  in_progress: 'GREENLIT',
  todo: 'TODO',
  in_review: 'AWAITING REVIEW',
  blocked: 'BLOCKED',
  awaiting_review: 'AWAITING REVIEW',
  decided: 'GREENLIT',
};

const STATUS_COLORS: Record<string, string> = {
  in_progress: '#00d4ff',
  todo: '#2a5f80',
  in_review: '#ff8800',
  blocked: '#ff4444',
};

export function PitchesPanel({ issues, onHearPitch, playingPitchId }: Props) {
  const [index, setIndex] = useState(0);

  const safeIndex = issues.length > 0 ? Math.min(index, issues.length - 1) : 0;
  const issue = issues[safeIndex] ?? null;
  const isPlaying = issue ? playingPitchId === issue.id : false;

  const prev = () => setIndex(i => Math.max(0, i - 1));
  const next = () => setIndex(i => Math.min(issues.length - 1, i + 1));

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <motion.span
          className="tracking-widest text-jarvis"
          style={{ fontSize: '0.6rem' }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          LEMON VIRTUAL PITCHES
        </motion.span>
        {issues.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="tracking-widest" style={{ color: '#1a3040', fontSize: '0.5rem' }}>
              {safeIndex + 1} / {issues.length}
            </span>
            <div className="flex gap-1">
              <button
                onClick={prev}
                disabled={safeIndex === 0}
                className="px-2 py-0.5 tracking-widest transition-opacity disabled:opacity-20"
                style={{ color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)', fontSize: '0.55rem', borderRadius: 2 }}
              >
                ‹
              </button>
              <button
                onClick={next}
                disabled={safeIndex >= issues.length - 1}
                className="px-2 py-0.5 tracking-widest transition-opacity disabled:opacity-20"
                style={{ color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)', fontSize: '0.55rem', borderRadius: 2 }}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="glow-line flex-shrink-0" />

      {/* Single pitch card */}
      <div className="flex-1 min-h-0 flex flex-col mt-3">
        {issues.length === 0 || !issue ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="tracking-widest text-center" style={{ color: '#1a3040', fontSize: '0.65rem' }}>
              NO ACTIVE PITCHES
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={issue.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col rounded"
              style={{
                background: isPlaying ? 'rgba(0,212,255,0.07)' : 'rgba(0,212,255,0.03)',
                border: `1px solid ${isPlaying ? 'rgba(0,212,255,0.4)' : 'rgba(0,212,255,0.12)'}`,
                padding: '14px 14px 12px',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              {/* Identifier + badges */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {issue.identifier && (
                  <span className="font-mono" style={{ color: '#00d4ff', opacity: 0.8, fontSize: '0.72rem' }}>
                    {issue.identifier}
                  </span>
                )}
                <span
                  className="tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    color: STATUS_COLORS[issue.status] ?? '#2a5f80',
                    background: `${STATUS_COLORS[issue.status] ?? '#2a5f80'}18`,
                    border: `1px solid ${STATUS_COLORS[issue.status] ?? '#2a5f80'}44`,
                    fontSize: '9px',
                  }}
                >
                  {STATUS_LABELS[issue.status] ?? issue.status.toUpperCase()}
                </span>
                <span
                  className="tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    color: PRIORITY_COLORS[issue.priority] ?? '#2a5f80',
                    background: `${PRIORITY_COLORS[issue.priority] ?? '#2a5f80'}18`,
                    border: `1px solid ${PRIORITY_COLORS[issue.priority] ?? '#2a5f80'}44`,
                    fontSize: '9px',
                  }}
                >
                  {issue.priority.toUpperCase()}
                </span>
              </div>

              {/* Title — large and readable */}
              <div
                className="flex-1 leading-relaxed"
                style={{ color: '#a8d8f0', fontSize: '0.92rem', lineHeight: '1.55' }}
              >
                {issue.title}
              </div>

              {/* "Pitch it to me" action */}
              {onHearPitch && (
                <div className="mt-4 flex-shrink-0">
                  <button
                    onClick={() => onHearPitch(issue)}
                    disabled={isPlaying}
                    className="w-full py-2 font-mono tracking-widest transition-all"
                    style={{
                      color: isPlaying ? '#34d399' : '#00d4ff',
                      border: `1px solid ${isPlaying ? 'rgba(52,211,153,0.5)' : 'rgba(0,212,255,0.4)'}`,
                      background: isPlaying ? 'rgba(52,211,153,0.07)' : 'rgba(0,212,255,0.05)',
                      fontSize: '0.6rem',
                      borderRadius: 3,
                    }}
                  >
                    {isPlaying ? (
                      <motion.span
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        ▶ JARVIS IS PITCHING...
                      </motion.span>
                    ) : (
                      '▶ PITCH IT TO ME'
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Dot nav */}
      {issues.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3 flex-shrink-0">
          {issues.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i === safeIndex ? '#00d4ff' : 'rgba(0,212,255,0.2)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
