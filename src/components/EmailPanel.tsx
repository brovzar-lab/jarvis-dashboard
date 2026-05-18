import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchEmails, type Email } from '../services/integrations';

export function EmailPanel() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmails().then(data => { setEmails(data); setLoading(false); });
  }, []);

  const unreadCount = emails.filter(e => e.unread).length;

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
      <div className="flex-1 overflow-y-auto mt-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.span
              className="text-xs tracking-widest text-jarvis-dim"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >SYNCING...</motion.span>
          </div>
        ) : emails.map((email, i) => (
          <motion.div
            key={email.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="py-2 border-b"
            style={{ borderColor: '#0a2a4a' }}
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
            </div>
            <div className="text-xs truncate mb-0.5" style={{ color: email.unread ? '#4a8fa8' : '#1e3a50', paddingLeft: email.unread ? '1rem' : 0 }}>
              {email.subject}
            </div>
            <div className="text-xs truncate" style={{ color: '#142030', fontSize: '0.6rem', paddingLeft: email.unread ? '1rem' : 0 }}>
              {email.preview}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
