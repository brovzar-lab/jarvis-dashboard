import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConversationEntry } from '../types';

interface Props {
  entries: ConversationEntry[];
}

export function ConversationHistory({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-jarvis">CONVERSATION LOG</span>
        <span className="text-xs text-jarvis-dim">{entries.length} ENTRIES</span>
      </div>
      <div className="glow-line" />
      <div className="flex-1 overflow-y-auto space-y-3 mt-2">
        {entries.length === 0 && (
          <div className="text-xs text-jarvis-dim text-center py-4">
            AWAITING VOICE INPUT
          </div>
        )}
        <AnimatePresence>
          {entries.map(entry => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex gap-2 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {entry.role === 'jarvis' && (
                <div
                  className="text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ color: '#00d4ff', width: 16, textAlign: 'center' }}
                >
                  J
                </div>
              )}
              <div
                className="rounded px-3 py-2 max-w-xs text-xs leading-relaxed"
                style={
                  entry.role === 'user'
                    ? { background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: '#7ecfff' }
                    : { background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)', color: '#5abf80' }
                }
              >
                {entry.text}
              </div>
              {entry.role === 'user' && (
                <div className="text-xs flex-shrink-0 mt-0.5" style={{ color: '#2a5f80', width: 16, textAlign: 'center' }}>
                  ›
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
