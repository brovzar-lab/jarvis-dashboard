import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Issue } from '../types';
import { useCardAction } from '../hooks/useCardAction';
import { getCompanyId } from '../services/paperclip';

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ff4444',
  high: '#ff8800',
  medium: '#00d4ff',
  low: '#2a5f80',
};

function PitchCard({ issue, onHear, isPlaying, onRefresh }: {
  issue: Issue;
  onHear?: (issue: Issue) => void;
  isPlaying: boolean;
  onRefresh: () => void;
}) {
  const cid = issue.companyId ?? getCompanyId();
  const { execute, isPending, didSucceed, didFail } = useCardAction(issue.id, cid, onRefresh);

  return (
    <div className="h-full flex flex-col px-3 pt-2 pb-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5 flex-shrink-0">
        {issue.identifier && (
          <span className="font-mono" style={{ color: '#00d4ff', opacity: 0.75, fontSize: '0.6rem' }}>
            {issue.identifier}
          </span>
        )}
        <span
          style={{
            color: PRIORITY_COLORS[issue.priority] ?? '#2a5f80',
            background: `${PRIORITY_COLORS[issue.priority] ?? '#2a5f80'}1a`,
            border: `1px solid ${PRIORITY_COLORS[issue.priority] ?? '#2a5f80'}44`,
            fontSize: '7px',
            padding: '1px 5px',
            borderRadius: 2,
          }}
        >
          {issue.priority.toUpperCase()}
        </span>
        {onHear && (
          <button
            onClick={() => onHear(issue)}
            disabled={isPlaying}
            className="ml-auto tracking-widest transition-opacity hover:opacity-100 opacity-55"
            style={{ color: isPlaying ? '#34d399' : '#00d4ff', fontSize: '7px' }}
          >
            {isPlaying ? '▶ PLAYING' : '▶ HEAR'}
          </button>
        )}
      </div>

      {/* Title */}
      <div
        className="flex-1 min-h-0 leading-snug"
        style={{ color: '#8dc8e8', fontSize: '0.8rem', lineHeight: 1.4, overflow: 'hidden' }}
      >
        {issue.title}
      </div>

      {/* DEVELOP / VAULT / KILL */}
      <div className="flex gap-1.5 mt-2 flex-shrink-0">
        {(didSucceed || didFail) ? (
          <div className="tracking-widest" style={{ color: didSucceed ? '#34d399' : '#ff4444', fontSize: '0.5rem' }}>
            {didSucceed ? '✓ COMMAND SENT' : '⚠ COMMAND FAILED'}
          </div>
        ) : (
          <>
            <button
              onClick={() => execute('patch_issue', { status: 'in_progress' })}
              disabled={isPending}
              className="flex-1 py-1 font-mono tracking-widest transition-all hover:opacity-100 opacity-65 disabled:opacity-25"
              style={{ color: '#34d399', border: '1px solid rgba(52,211,153,0.4)', fontSize: '0.5rem', borderRadius: 2 }}
            >
              DEVELOP
            </button>
            <button
              onClick={() => execute('patch_issue', { status: 'blocked' })}
              disabled={isPending}
              className="flex-1 py-1 font-mono tracking-widest transition-all hover:opacity-100 opacity-65 disabled:opacity-25"
              style={{ color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', fontSize: '0.5rem', borderRadius: 2 }}
            >
              VAULT
            </button>
            <button
              onClick={() => execute('patch_issue', { status: 'cancelled' })}
              disabled={isPending}
              className="flex-1 py-1 font-mono tracking-widest transition-all hover:opacity-100 opacity-65 disabled:opacity-25"
              style={{ color: '#ff4444', border: '1px solid rgba(255,68,68,0.4)', fontSize: '0.5rem', borderRadius: 2 }}
            >
              KILL
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface Props {
  issues: Issue[];
  onHearPitch?: (issue: Issue) => void;
  playingPitchId?: string | null;
  onRefresh: () => void;
}

export function PitchCarousel({ issues, onHearPitch, playingPitchId, onRefresh }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const touchStartX = useRef(0);

  if (issues.length === 0) return null;

  const safeIndex = Math.min(index, issues.length - 1);
  const issue = issues[safeIndex];

  const goNext = () => {
    if (safeIndex >= issues.length - 1) return;
    setDirection(1);
    setIndex(i => i + 1);
  };

  const goPrev = () => {
    if (safeIndex <= 0) return;
    setDirection(-1);
    setIndex(i => i - 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) {
      if (delta > 0) goNext();
      else goPrev();
    }
  };

  return (
    <div className="flex-shrink-0" style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }}>
      {/* Header bar */}
      <div className="flex items-center px-4 pt-2 pb-0.5">
        <motion.span
          className="tracking-widest flex-1"
          style={{ color: '#1a4060', fontSize: '0.48rem' }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          ◆ LEMON VIRTUAL PITCHES
        </motion.span>
        <div className="flex items-center gap-1">
          <span style={{ color: '#0d2030', fontSize: '0.42rem' }}>{safeIndex + 1} / {issues.length}</span>
          <button
            onClick={goPrev}
            disabled={safeIndex === 0}
            style={{
              color: '#00d4ff',
              fontSize: '0.9rem',
              opacity: safeIndex === 0 ? 0.15 : 0.55,
              lineHeight: 1,
              padding: '0 5px',
              background: 'none',
              border: 'none',
              cursor: safeIndex === 0 ? 'default' : 'pointer',
            }}
          >‹</button>
          <button
            onClick={goNext}
            disabled={safeIndex >= issues.length - 1}
            style={{
              color: '#00d4ff',
              fontSize: '0.9rem',
              opacity: safeIndex >= issues.length - 1 ? 0.15 : 0.55,
              lineHeight: 1,
              padding: '0 5px',
              background: 'none',
              border: 'none',
              cursor: safeIndex >= issues.length - 1 ? 'default' : 'pointer',
            }}
          >›</button>
        </div>
      </div>

      {/* Swipeable card */}
      <div
        className="px-3 pb-2.5 overflow-hidden"
        style={{ height: 122 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={issue.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -28 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="h-full rounded"
            style={{
              border: '1px solid rgba(0,212,255,0.14)',
              background: 'rgba(0,212,255,0.025)',
              overflow: 'hidden',
            }}
          >
            <PitchCard
              issue={issue}
              onHear={onHearPitch}
              isPlaying={playingPitchId === issue.id}
              onRefresh={onRefresh}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot nav */}
      {issues.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-2">
          {issues.map((_, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > safeIndex ? 1 : -1); setIndex(i); }}
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: i === safeIndex ? '#00d4ff' : 'rgba(0,212,255,0.18)',
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
