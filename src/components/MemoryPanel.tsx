import { useState } from 'react';
import type { Memory } from '../types/memory';

interface Props {
  memories: Memory[];
  onClear: (scope: 'session' | 'all') => void;
}

const TYPE_COLORS: Record<string, string> = {
  preference: '#00d4ff',
  fact: '#5098b8',
  experience: '#fbbf24',
  observation: '#a855f7',
};

const TYPE_ICONS: Record<string, string> = {
  preference: '★',
  fact: '◆',
  experience: '💰',
  observation: '◎',
};

export function MemoryPanel({ memories, onClear }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const [confirmClear, setConfirmClear] = useState<'session' | 'all' | null>(null);

  const active = memories.filter(m => !m.archived);
  const globals = active.filter(m => m.scope === 'global');
  const sessions = active.filter(m => m.scope === 'session');

  const typeCounts = active.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="panel-border corner-decoration rounded h-full flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.1)' }}
      >
        <span className="tracking-widest" style={{ color: '#00d4ff', fontSize: '0.48rem', letterSpacing: '0.2em' }}>
          ◉ BRAIN · LEARNED MEMORY
        </span>
        <div className="flex items-center gap-2">
          <span className="tracking-widest" style={{ color: '#2a6080', fontSize: '0.42rem' }}>
            {active.length} active
          </span>
          <button
            onClick={() => setShowArchived(v => !v)}
            className="tracking-widest transition-opacity hover:opacity-100 opacity-50"
            style={{ color: '#2a6080', fontSize: '0.42rem', border: '1px solid rgba(0,212,255,0.1)', padding: '1px 5px', borderRadius: 2 }}
          >
            {showArchived ? 'HIDE ARCHIVED' : 'ARCHIVED'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div
        className="flex gap-0 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.06)' }}
      >
        {(['preference', 'fact', 'experience', 'observation'] as const).map(type => (
          <div
            key={type}
            className="flex-1 text-center py-1"
            style={{ borderRight: '1px solid rgba(0,212,255,0.06)' }}
          >
            <div style={{ color: TYPE_COLORS[type], fontSize: '0.65rem', fontWeight: 600 }}>
              {typeCounts[type] ?? 0}
            </div>
            <div className="tracking-widest" style={{ color: '#1a3040', fontSize: '0.38rem' }}>
              {type.slice(0, 4).toUpperCase()}
            </div>
          </div>
        ))}
        <div className="flex-1 text-center py-1">
          <div style={{ color: '#2a6080', fontSize: '0.65rem', fontWeight: 600 }}>
            {memories.filter(m => m.archived).length}
          </div>
          <div className="tracking-widest" style={{ color: '#1a3040', fontSize: '0.38rem' }}>ARCH</div>
        </div>
      </div>

      {/* Memory list */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '8px 10px' }}>
        {active.length === 0 && (
          <div className="text-center py-4 tracking-widest" style={{ color: '#1a3040', fontSize: '0.48rem' }}>
            NO MEMORIES YET<br />
            <span style={{ fontSize: '0.42rem', opacity: 0.5 }}>JARVIS will learn from your conversations</span>
          </div>
        )}

        {globals.length > 0 && (
          <>
            <div className="tracking-widest mb-1.5" style={{ color: '#2a6080', fontSize: '0.42rem' }}>
              GLOBAL · {globals.length}
            </div>
            <div className="space-y-1 mb-3">
              {globals.map(m => (
                <MemoryRow key={m.id} memory={m} />
              ))}
            </div>
          </>
        )}

        {sessions.length > 0 && (
          <>
            <div className="tracking-widest mb-1.5" style={{ color: '#2a6080', fontSize: '0.42rem' }}>
              SESSION · {sessions.length}
            </div>
            <div className="space-y-1 mb-3">
              {sessions.map(m => (
                <MemoryRow key={m.id} memory={m} />
              ))}
            </div>
          </>
        )}

        {showArchived && memories.filter(m => m.archived).length > 0 && (
          <>
            <div className="tracking-widest mb-1.5" style={{ color: '#1a3040', fontSize: '0.42rem' }}>
              ARCHIVED
            </div>
            <div className="space-y-1 opacity-40">
              {memories.filter(m => m.archived).map(m => (
                <MemoryRow key={m.id} memory={m} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div
        className="flex gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(0,212,255,0.06)' }}
      >
        {confirmClear ? (
          <>
            <span className="tracking-widest flex-1" style={{ color: '#ff4444', fontSize: '0.42rem' }}>
              Clear {confirmClear === 'session' ? 'session' : 'ALL'} memories?
            </span>
            <button
              onClick={() => { onClear(confirmClear); setConfirmClear(null); }}
              className="tracking-widest hover:opacity-100 opacity-80"
              style={{ color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)', fontSize: '0.42rem', padding: '2px 8px', borderRadius: 2 }}
            >
              CONFIRM
            </button>
            <button
              onClick={() => setConfirmClear(null)}
              className="tracking-widest hover:opacity-100 opacity-60"
              style={{ color: '#2a6080', border: '1px solid rgba(0,212,255,0.1)', fontSize: '0.42rem', padding: '2px 8px', borderRadius: 2 }}
            >
              CANCEL
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setConfirmClear('session')}
              className="tracking-widest hover:opacity-100 opacity-50"
              style={{ color: '#2a6080', border: '1px solid rgba(0,212,255,0.1)', fontSize: '0.42rem', padding: '2px 8px', borderRadius: 2 }}
            >
              CLEAR SESSION
            </button>
            <button
              onClick={() => setConfirmClear('all')}
              className="tracking-widest hover:opacity-100 opacity-40"
              style={{ color: '#ff4444', border: '1px solid rgba(255,68,68,0.15)', fontSize: '0.42rem', padding: '2px 8px', borderRadius: 2 }}
            >
              CLEAR ALL
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MemoryRow({ memory }: { memory: Memory }) {
  const color = TYPE_COLORS[memory.type] ?? '#5098b8';
  const confPct = Math.round(memory.confidence * 100);

  return (
    <div
      className="rounded px-2 py-1.5"
      style={{ background: 'rgba(0,212,255,0.02)', border: '1px solid rgba(0,212,255,0.06)' }}
    >
      <div className="flex items-start gap-1.5">
        <span style={{ color, fontSize: '0.55rem', flexShrink: 0, marginTop: 1 }}>
          {TYPE_ICONS[memory.type] ?? '◆'}
        </span>
        <span style={{ color: '#5098b8', fontSize: '0.6rem', lineHeight: 1.4, flex: 1 }}>
          {memory.content}
        </span>
        <span
          className="tracking-widest flex-shrink-0"
          style={{ color: confPct >= 70 ? '#2a6080' : '#1a3040', fontSize: '0.38rem', marginTop: 2 }}
        >
          {confPct}%
        </span>
      </div>
    </div>
  );
}
