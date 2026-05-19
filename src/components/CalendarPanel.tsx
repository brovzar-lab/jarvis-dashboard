import { motion } from 'framer-motion';
import type { CalendarEvent } from '../services/integrations';
import { useCalendar } from '../hooks/useCalendar';

function eventTypeStyle(type: CalendarEvent['type']): { color: string; bg: string; border: string } {
  if (type === 'meeting') return { color: '#7ecfff', bg: 'rgba(0,212,255,0.06)', border: 'rgba(0,212,255,0.15)' };
  if (type === 'focus') return { color: '#34d399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.15)' };
  if (type === 'deadline') return { color: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.2)' };
  return { color: '#a78bfa', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.15)' };
}

const TYPE_LABELS: Record<CalendarEvent['type'], string> = {
  meeting: 'MTG',
  focus: 'FOCUS',
  deadline: 'DUE',
  personal: 'PERSONAL',
};

export function CalendarPanel() {
  const { data: events = [], isLoading: loading } = useCalendar();

  const upcoming = events.filter(e => !e.past);
  const nextEvent = upcoming[0];

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-jarvis">CALENDAR</span>
        <span className="text-xs text-jarvis-dim">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
        </span>
      </div>
      <div className="glow-line" />

      {nextEvent && !loading && (
        <div
          className="mt-2 mb-2 px-2 py-1.5 rounded"
          style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.12)' }}
        >
          <div className="text-xs tracking-widest mb-0.5" style={{ color: '#2a5f80' }}>NEXT UP</div>
          <div className="text-xs font-medium truncate" style={{ color: '#7ecfff' }}>{nextEvent.title}</div>
          <div className="text-xs mt-0.5" style={{ color: '#1a4060' }}>
            {nextEvent.time}{nextEvent.duration && ` · ${nextEvent.duration}`}
            {nextEvent.attendees ? ` · ${nextEvent.attendees} attendees` : ''}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.span
              className="text-xs tracking-widest text-jarvis-dim"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >SYNCING...</motion.span>
          </div>
        ) : events.map((event, i) => {
          const style = eventTypeStyle(event.type);
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-start gap-2 py-1.5 border-b"
              style={{ borderColor: '#0a2a4a', opacity: event.past ? 0.35 : 1 }}
            >
              <span
                className="text-xs px-1 flex-shrink-0 mt-0.5"
                style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}`, borderRadius: 2, fontSize: '0.55rem', letterSpacing: '0.08em' }}
              >
                {TYPE_LABELS[event.type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate" style={{ color: event.past ? '#1a4060' : '#5a9fbe' }}>
                  {event.title}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#0d2030', fontSize: '0.6rem' }}>
                  {event.time}{event.duration && ` · ${event.duration}`}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
