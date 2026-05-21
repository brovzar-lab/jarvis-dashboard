import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Email } from '../services/integrations';
import { useEmail } from '../hooks/useEmail';

interface Props {
  onAction?: (query: string) => void;
}

const BTN = {
  fontSize: '0.5rem',
  padding: '2px 6px',
  borderRadius: 2,
  background: 'transparent',
  border: '1px solid rgba(0,212,255,0.3)',
  color: '#7ecfff',
  letterSpacing: '0.08em',
  cursor: 'pointer',
  lineHeight: 1.6,
} as React.CSSProperties;

export function EmailPanel({ onAction }: Props) {
  const { data: emails = [], isLoading: loading } = useEmail();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ignored, setIgnored] = useState<Set<string>>(new Set());

  const visible = emails.filter(e => !ignored.has(e.id));
  const unreadCount = visible.filter(e => e.unread).length;

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
      {onAction && !loading && visible.length > 0 && (
        <div className="text-xs mt-1 mb-0" style={{ color: '#5098b8', fontSize: '0.55rem', letterSpacing: '0.05em' }}>
          CLICK TO BRIEF · USE BUTTONS TO ACT
        </div>
      )}
      <div className="flex-1 overflow-y-auto mt-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.span
              className="text-xs tracking-widest"
              style={{ color: '#5098b8' }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >SYNCING...</motion.span>
          </div>
        ) : visible.map((email, i) => {
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
              className="rounded"
              style={{
                borderBottom: '1px solid rgba(0,212,255,0.08)',
                cursor: onAction ? 'pointer' : 'default',
                background: isActive ? 'rgba(251,191,36,0.04)' : 'transparent',
                transition: 'background 0.2s',
                padding: '7px 3px 8px',
              }}
            >
              {/* Row 1: sender + time + open-link */}
              <div className="flex items-center gap-1.5 mb-0.5">
                {email.unread && (
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: email.priority === 'high' ? '#fbbf24' : '#00d4ff' }} />
                )}
                <span
                  className="text-xs font-medium truncate flex-1 min-w-0"
                  style={{ color: email.unread ? (email.priority === 'high' ? '#fbbf24' : '#d0eeff') : '#8ac8e8' }}
                >
                  {email.from}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: '#5098b8', fontSize: '0.6rem' }}>{email.time}</span>
                {email.link && (
                  <button
                    onClick={e => openEmail(e, email.link!)}
                    title="Open in Gmail"
                    className="flex-shrink-0 transition-opacity opacity-50 hover:opacity-100"
                    style={{ color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)', fontSize: '6px', padding: '1px 4px', borderRadius: 2, background: 'transparent', lineHeight: 1.4 }}
                  >
                    ↗
                  </button>
                )}
              </div>

              {/* Row 2: subject */}
              <div className="text-xs truncate mb-0.5" style={{ color: email.unread ? '#d0eeff' : '#8ac8e8', paddingLeft: email.unread ? '1rem' : 0, fontWeight: email.unread ? 500 : 400 }}>
                {email.subject}
              </div>

              {/* Row 3: preview snippet */}
              <div className="text-xs truncate" style={{ color: '#5098b8', fontSize: '0.6rem', paddingLeft: email.unread ? '1rem' : 0 }}>
                {email.preview}
              </div>

              {/* Row 4: action buttons */}
              {onAction && (
                <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                  <button
                    style={BTN}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#7ecfff')}
                    onClick={() => onAction(`Help me draft a reply to this email. From: ${email.from} | Subject: ${email.subject} | Preview: "${email.preview}"`)}
                  >REPLY</button>
                  <button
                    style={{ ...BTN, color: '#00ff88', borderColor: 'rgba(0,255,136,0.3)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#00ff88')}
                    onClick={() => onAction(`Add to my to-do list: "${email.subject}" from ${email.from}`)}
                  >+ TODO</button>
                  <button
                    style={{ ...BTN, color: '#ff7a7a', borderColor: 'rgba(255,122,122,0.3)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#ff7a7a')}
                    onClick={() => setIgnored(prev => new Set([...prev, email.id]))}
                  >IGNORE</button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
