import { motion, AnimatePresence } from 'framer-motion';
import type { JarvisCommand } from '../services/command-executor';

interface Props {
  command: JarvisCommand | null;
  isExecuting: boolean;
  countdown: number;
  onExecute: () => void;
  onCancel: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  patch_issue: 'MODIFY ISSUE',
  create_issue: 'CREATE ISSUE',
  add_comment: 'POST COMMENT',
  get_issue: 'FETCH ISSUE',
};

export function CommandConfirmation({ command, isExecuting, countdown, onExecute, onCancel }: Props) {
  const countdownColor = countdown <= 5 ? 'rgba(255,100,100,0.8)' : 'rgba(0,212,255,0.7)';

  return (
    <AnimatePresence>
      {command && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(2,11,24,0.92)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-sm mx-4 rounded"
            style={{
              border: '1px solid rgba(0,212,255,0.4)',
              background: 'rgba(0,20,40,0.95)',
              boxShadow: '0 0 40px rgba(0,212,255,0.15), inset 0 0 20px rgba(0,212,255,0.03)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-2 text-xs tracking-widest"
              style={{ borderBottom: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}
            >
              <span>COMMAND PENDING</span>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-xs tracking-widest"
                  style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}
                >
                  {ACTION_LABELS[command.action] ?? command.action.toUpperCase()}
                </span>
                {countdown > 0 && (
                  <span
                    className="text-xs font-mono tabular-nums"
                    style={{ color: countdownColor, minWidth: '1.5rem', textAlign: 'right' }}
                  >
                    {countdown}s
                  </span>
                )}
              </div>
            </div>

            {/* Countdown progress bar */}
            {countdown > 0 && (
              <div style={{ height: 2, background: 'rgba(0,212,255,0.08)' }}>
                <motion.div
                  style={{
                    height: '100%',
                    background: countdown <= 5 ? 'rgba(255,100,100,0.6)' : 'rgba(0,212,255,0.4)',
                    width: `${(countdown / 15) * 100}%`,
                    transition: 'width 1s linear, background 0.3s ease',
                  }}
                />
              </div>
            )}

            {/* Body */}
            <div className="px-4 py-4">
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(200,230,255,0.9)' }}>
                {command.confirmation}
              </p>
            </div>

            {/* Voice hint */}
            <div className="px-4 pb-2 text-xs tracking-widest" style={{ color: 'rgba(0,212,255,0.4)' }}>
              SAY "YES", "DO IT", "GO AHEAD" TO CONFIRM — OR "CANCEL", "NO", "STOP"
            </div>

            {/* Actions */}
            <div
              className="flex gap-3 px-4 py-3"
              style={{ borderTop: '1px solid rgba(0,212,255,0.1)' }}
            >
              <button
                onClick={onCancel}
                disabled={isExecuting}
                className="flex-1 py-2 text-xs tracking-widest rounded transition-colors"
                style={{
                  border: '1px solid rgba(0,212,255,0.2)',
                  color: 'rgba(0,212,255,0.6)',
                  background: 'transparent',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={onExecute}
                disabled={isExecuting}
                className="flex-1 py-2 text-xs tracking-widest rounded transition-all"
                style={{
                  border: '1px solid rgba(0,212,255,0.6)',
                  background: isExecuting ? 'rgba(0,212,255,0.05)' : 'rgba(0,212,255,0.12)',
                  color: isExecuting ? 'rgba(0,212,255,0.4)' : '#00d4ff',
                  boxShadow: isExecuting ? 'none' : '0 0 12px rgba(0,212,255,0.2)',
                }}
              >
                {isExecuting ? 'EXECUTING...' : 'EXECUTE'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
