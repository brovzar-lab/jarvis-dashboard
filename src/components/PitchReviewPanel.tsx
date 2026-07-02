import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PitchSessionState } from '../hooks/usePitchReview';
import { executePitchVerdict } from '../services/paperclip';
import type { Issue } from '../types';

interface Props {
  session: PitchSessionState;
  pendingPitches: Issue[];
  onStartReview: () => void;
  onVerdict: (verdict: 'develop' | 'resolve' | 'kill') => void;
  onAbort: () => void;
}

type DirectVerdict = 'develop' | 'resolve' | 'kill';

interface Toast {
  msg: string;
  ok: boolean;
}

const VERDICT_STYLES: Record<DirectVerdict, { color: string; bg: string; border: string }> = {
  develop: { color: '#34d399', bg: 'rgba(52,211,153,0.05)', border: 'rgba(52,211,153,0.4)' },
  resolve: { color: '#fbbf24', bg: 'rgba(251,191,36,0.05)', border: 'rgba(251,191,36,0.4)' },
  kill:    { color: '#ff4444', bg: 'rgba(255,68,68,0.05)',  border: 'rgba(255,68,68,0.4)' },
};

export function PitchReviewPanel({ session, pendingPitches, onStartReview, onVerdict, onAbort }: Props) {
  const { active, pitches, currentIndex, stats, status } = session;
  const currentPitch = active && pitches.length > 0 ? pitches[Math.min(currentIndex, pitches.length - 1)] : null;
  const isExecuting = status === 'executing' || status === 'fetching' || status === 'pitching';

  const [executingId, setExecutingId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const visiblePitches = pendingPitches.filter(p => !dismissedIds.has(p.id));

  const handleDirectVerdict = async (pitch: Issue, verdict: DirectVerdict) => {
    if (executingId) return;
    setExecutingId(pitch.id);
    try {
      await executePitchVerdict(pitch.id, verdict);
      setDismissedIds(prev => new Set([...prev, pitch.id]));
      const labels = { develop: 'Greenlighted', resolve: 'Resolved', kill: 'Killed' };
      setToast({ msg: `${labels[verdict]}: "${pitch.title}"`, ok: true });
    } catch {
      setToast({ msg: `Failed to ${verdict} "${pitch.title}"`, ok: false });
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <motion.span
          className="tracking-widest text-jarvis"
          style={{ fontSize: '0.65rem' }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          LEMA VIRTUAL STUDIOS · DEVELOPMENT GATE
        </motion.span>
        {active && (
          <div className="flex items-center gap-2">
            <span className="tracking-widest" style={{ color: '#1a3040', fontSize: '0.5rem' }}>
              {currentIndex + 1} / {pitches.length} · GATE
            </span>
            <button
              onClick={onAbort}
              className="px-2 py-0.5 tracking-widest transition-opacity hover:opacity-80"
              style={{ color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)', fontSize: '0.5rem', borderRadius: 2 }}
            >
              END
            </button>
          </div>
        )}
      </div>
      <div className="glow-line flex-shrink-0" />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-2 px-2 py-1 rounded tracking-widest flex-shrink-0"
            style={{
              fontSize: '0.48rem',
              color: toast.ok ? '#34d399' : '#ff4444',
              background: toast.ok ? 'rgba(52,211,153,0.08)' : 'rgba(255,68,68,0.08)',
              border: `1px solid ${toast.ok ? 'rgba(52,211,153,0.25)' : 'rgba(255,68,68,0.25)'}`,
            }}
          >
            {toast.ok ? '✓' : '✗'} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 flex flex-col mt-3">
        <AnimatePresence mode="wait">
          {/* IDLE — no active session */}
          {!active && status !== 'summary' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col justify-between"
            >
              {visiblePitches.length === 0 ? (
                <div className="tracking-widest" style={{ color: '#1a3040', fontSize: '0.65rem' }}>
                  NO PITCHES PENDING
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="tracking-widest" style={{ color: '#2a5f80', fontSize: '0.55rem' }}>
                      {visiblePitches.length} IN GATE
                    </div>
                    <button
                      onClick={onStartReview}
                      disabled={!!executingId}
                      className="px-2 py-1 font-mono tracking-widest transition-all hover:opacity-90 disabled:opacity-40"
                      style={{
                        color: '#00d4ff',
                        border: '1px solid rgba(0,212,255,0.4)',
                        background: 'rgba(0,212,255,0.05)',
                        fontSize: '0.55rem',
                        borderRadius: 2,
                      }}
                    >
                      ▶ REVIEW
                    </button>
                  </div>
                  {/* Scrollable pitch list with per-row action buttons */}
                  <div className="overflow-y-auto space-y-1.5" style={{ maxHeight: 180 }}>
                    {visiblePitches.map((pitch) => {
                      const isThisExecuting = executingId === pitch.id;
                      return (
                        <div
                          key={pitch.id}
                          className="rounded px-2 py-1.5"
                          style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}
                        >
                          <div
                            className="mb-1.5"
                            style={{ color: '#8ac8e8', fontSize: '0.72rem', lineHeight: 1.35 }}
                          >
                            {pitch.title}
                          </div>
                          <div className="flex gap-1">
                            {(['develop', 'resolve', 'kill'] as const).map(v => (
                              <button
                                key={v}
                                onClick={() => handleDirectVerdict(pitch, v)}
                                disabled={!!executingId}
                                className="flex-1 py-0.5 font-mono tracking-widest transition-all disabled:opacity-30"
                                style={{
                                  color: VERDICT_STYLES[v].color,
                                  border: `1px solid ${VERDICT_STYLES[v].border}`,
                                  background: isThisExecuting ? `${VERDICT_STYLES[v].bg}` : 'transparent',
                                  fontSize: '0.42rem',
                                  borderRadius: 2,
                                }}
                              >
                                {isThisExecuting ? '…' : v.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ACTIVE SESSION — pitching / awaiting_verdict / executing */}
          {active && currentPitch && (
            <motion.div
              key={`pitch-${currentPitch.id}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {/* Status badge */}
              <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <motion.span
                  className="tracking-widest px-1.5 py-0.5 rounded"
                  animate={{ opacity: status === 'awaiting_verdict' ? [1, 0.5, 1] : 1 }}
                  transition={{ duration: 1.2, repeat: status === 'awaiting_verdict' ? Infinity : 0 }}
                  style={{
                    color: status === 'awaiting_verdict' ? '#00d4ff'
                      : status === 'executing' ? '#fbbf24'
                      : '#2a5f80',
                    background: status === 'awaiting_verdict' ? 'rgba(0,212,255,0.08)'
                      : status === 'executing' ? 'rgba(251,191,36,0.08)'
                      : 'rgba(42,95,128,0.08)',
                    border: `1px solid ${status === 'awaiting_verdict' ? 'rgba(0,212,255,0.3)' : status === 'executing' ? 'rgba(251,191,36,0.3)' : 'rgba(42,95,128,0.2)'}`,
                    fontSize: '8px',
                  }}
                >
                  {status === 'awaiting_verdict' ? '⬡ YOUR CALL'
                    : status === 'executing' ? '⬡ EXECUTING'
                    : status === 'fetching' ? '⬡ LOADING'
                    : '▶ READING'}
                </motion.span>
                <span className="tracking-widest" style={{ color: '#1a3040', fontSize: '0.48rem' }}>
                  PITCH {currentIndex + 1} OF {pitches.length}
                </span>
              </div>

              {/* Pitch title */}
              <div
                className="flex-1 min-h-0 leading-snug mb-3"
                style={{
                  color: '#a8d8f0',
                  fontSize: '0.88rem',
                  lineHeight: '1.55',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {currentPitch.title}
              </div>

              {/* Stats mini-row */}
              <div className="flex gap-2 mb-3 flex-shrink-0">
                {[
                  { label: 'DEV', value: stats.developed, color: '#34d399' },
                  { label: 'RESOLVE', value: stats.resolved, color: '#fbbf24' },
                  { label: 'KILL', value: stats.killed, color: '#ff4444' },
                ].map(s => (
                  <div
                    key={s.label}
                    className="flex-1 text-center py-0.5"
                    style={{ border: `1px dashed ${s.color}22`, borderRadius: 2 }}
                  >
                    <div style={{ color: s.color, fontSize: '0.7rem', fontWeight: 500 }}>{s.value}</div>
                    <div className="tracking-widest" style={{ color: s.color, opacity: 0.4, fontSize: '0.4rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Verdict buttons */}
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => onVerdict('develop')}
                  disabled={isExecuting}
                  className="flex-1 py-1.5 font-mono tracking-widest transition-all disabled:opacity-25"
                  style={{
                    color: '#34d399',
                    border: '1px solid rgba(52,211,153,0.4)',
                    background: 'rgba(52,211,153,0.05)',
                    fontSize: '0.5rem',
                    borderRadius: 2,
                  }}
                >
                  DEVELOP
                </button>
                <button
                  onClick={() => onVerdict('resolve')}
                  disabled={isExecuting}
                  className="flex-1 py-1.5 font-mono tracking-widest transition-all disabled:opacity-25"
                  style={{
                    color: '#fbbf24',
                    border: '1px solid rgba(251,191,36,0.4)',
                    background: 'rgba(251,191,36,0.05)',
                    fontSize: '0.5rem',
                    borderRadius: 2,
                  }}
                >
                  RESOLVE
                </button>
                <button
                  onClick={() => onVerdict('kill')}
                  disabled={isExecuting}
                  className="flex-1 py-1.5 font-mono tracking-widest transition-all disabled:opacity-25"
                  style={{
                    color: '#ff4444',
                    border: '1px solid rgba(255,68,68,0.4)',
                    background: 'rgba(255,68,68,0.05)',
                    fontSize: '0.5rem',
                    borderRadius: 2,
                  }}
                >
                  KILL
                </button>
              </div>
            </motion.div>
          )}

          {/* SUMMARY state — briefly shown before resetting to idle */}
          {status === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-3"
            >
              <div className="tracking-widest" style={{ color: '#00d4ff', fontSize: '0.55rem' }}>SESSION COMPLETE</div>
              <div className="flex gap-4">
                {[
                  { label: 'GREENLIT', value: stats.developed, color: '#34d399' },
                  { label: 'RESOLVED', value: stats.resolved, color: '#fbbf24' },
                  { label: 'KILLED', value: stats.killed, color: '#ff4444' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div style={{ color: s.color, fontSize: '1.4rem', fontWeight: 300 }}>{s.value}</div>
                    <div className="tracking-widest" style={{ color: s.color, opacity: 0.5, fontSize: '0.42rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
