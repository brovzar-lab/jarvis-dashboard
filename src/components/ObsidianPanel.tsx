import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchObsidian, type ObsidianNote } from '../services/integrations';

export function ObsidianPanel() {
  const [notes, setNotes] = useState<ObsidianNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchObsidian().then(data => { setNotes(data); setLoading(false); });
  }, []);

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-jarvis">OBSIDIAN BRAIN</span>
        <span
          className="text-xs tracking-widest px-1.5 py-0.5"
          style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 2, fontSize: '0.6rem' }}
        >
          {notes.length} NOTES
        </span>
      </div>
      <div className="glow-line" style={{ background: 'linear-gradient(90deg, transparent, #a78bfa, transparent)' }} />
      <div className="flex-1 overflow-y-auto mt-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.span
              className="text-xs tracking-widest"
              style={{ color: '#a78bfa' }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >INDEXING VAULT...</motion.span>
          </div>
        ) : notes.map((note, i) => (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="py-2 border-b"
            style={{ borderColor: '#0a1a3a' }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span style={{ color: '#a78bfa', fontSize: '0.6rem', flexShrink: 0 }}>◆</span>
              <span className="text-xs font-medium truncate" style={{ color: '#c4b0ff' }}>{note.title}</span>
              <span className="text-xs flex-shrink-0" style={{ color: '#1a2040', fontSize: '0.55rem' }}>{note.modified}</span>
            </div>
            <div className="text-xs truncate mb-1" style={{ color: '#1e3060', paddingLeft: '1rem', fontSize: '0.6rem' }}>
              {note.path}
            </div>
            {note.preview && (
              <div className="text-xs" style={{ color: '#2a3a60', paddingLeft: '1rem', fontSize: '0.6rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {note.preview}
              </div>
            )}
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 pl-4">
                {note.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-1"
                    style={{ color: '#6b5a9e', background: 'rgba(107,90,158,0.1)', borderRadius: 2, fontSize: '0.55rem' }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
