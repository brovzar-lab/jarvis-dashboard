import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Email } from '../services/integrations';
import { useEmail } from '../hooks/useEmail';

interface Props {
  onAction?: (query: string) => void;
}

export function EmailPanel({ onAction }: Props) {
  const { data: emails = [], isLoading: loading } = useEmail();
  const [activeId, setActiveId] = useState<string | null>(null);

  const unreadCount = emails.filter(e => e.unread).length;

  const handleEmailClick = (email: Email) => {
    if (!onAction) return;
    setActiveId(email.id);
    setTimeout(() => setActiveId(null), 1500);
    onAction(`Summarize this email and flag any action items: From: ${email.from} | Subject: ${email.subject} | "${email.preview}"`);
  };

  const openEmail = (e: React.MouseEvent, link: string) => {
    e.stopPropagation();
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-jarvis">INBOX</span>
        {unreadCount > 0 && (
          <span
            className="text-xs tracking-widest px-1.5 py-0.5"
            style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 2 }}
          >
            {unreadCount} UNREAD
          </span>
        )}
      </div>
      <div className="glow-line" />
      {onAction && !loading && emails.length > 0 && (
        <div className="text-xs mt-1 mb-0" style={{ color: '#1a3040', fontSize: '0.55rem', letterSpacing: '0.05em' }}>
          CLICK EMAIL TO BRIEF JARVIS
        </div>
      )}
      <div className="flex-1 overflow-y-auto mt-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.span
              className="text-xs tracking-widest text-jarvis-dim"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >SYNCING...</motion.span>
          </div>
        ) : emails.map((email, i) => {
          const isActive = activeId === email.id;
          return (
            <motion.div
              key={email.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{
                opacity: 1,
                x: 0,
                boxShadow: isActive ? '0 0 8px rgba(251,191,36,0.4)' : '0 0 0 transparent',
              }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleEmailClick(email)}
              className="py-2 border-b rounded"
              style={{
                borderColor: '#0a2a4a',
                cursor: onAction ? 'pointer' : 'default',
                background: isActive ? 'rgba(251,191,36,0.04)' : 'transparent',
                transition: 'background 0.2s',
                padding: '6px 3px',
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {email.unread && (
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: email.priority === 'high' ? '#fbbf24' : '#00d4ff' }} />
                )}
                <span
                  className="text-xs font-medium truncate flex-1 min-w-0"
                  style={{ color: email.unread ? (email.priority === 'high' ? '#fbbf24' : '#7ecfff') : '#2a5f80' }}
                >
                  {email.from}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: '#1a4060', fontSize: '0.6rem' }}>{email.time}</span>
                {email.link && (
                  <button
                    onClick={e => openEmail(e, email.link!)}
                    title="Open in Gmail"
                    className="flex-shrink-0 transition-opacity opacity-40 hover:opacity-100"
                    style={{ color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)', fontSize: '6px', padding: '1px 4px', borderRadius: 2, background: 'transparent', lineHeight: 1.4 }}
                  >
                    ↗
                  </button>
                )}
              </div>
              <div className="text-xs truncate mb-0.5" style={{ color: email.unread ? '#4a8fa8' : '#1e3a50', paddingLeft: email.unread ? '1rem' : 0 }}>
                {email.subject}
              </div>
              <div className="text-xs truncate" style={{ color: '#142030', fontSize: '0.6rem', paddingLeft: email.unread ? '1rem' : 0 }}>
                {email.preview}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
