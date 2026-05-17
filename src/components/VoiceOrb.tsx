import { motion } from 'framer-motion';
import type { OrbState } from '../types';

interface Props {
  state: OrbState;
  onClick: () => void;
}

const ORB_COLORS: Record<OrbState, string> = {
  idle: '#00d4ff',
  listening: '#00d4ff',
  thinking: '#7c3aed',
  speaking: '#00ff88',
};

const ORB_LABELS: Record<OrbState, string> = {
  idle: 'ACTIVATE',
  listening: 'LISTENING',
  thinking: 'PROCESSING',
  speaking: 'SPEAKING',
};

export function VoiceOrb({ state, onClick }: Props) {
  const color = ORB_COLORS[state];

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* outer rings */}
      {state !== 'idle' && (
        <>
          <motion.div
            className="absolute rounded-full border opacity-20"
            style={{ borderColor: color, width: 220, height: 220 }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full border opacity-10"
            style={{ borderColor: color, width: 280, height: 280 }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0, 0.1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          />
        </>
      )}

      {/* main orb */}
      <motion.button
        onClick={onClick}
        className="relative rounded-full border-2 cursor-pointer focus:outline-none"
        style={{
          width: 160,
          height: 160,
          borderColor: color,
          background: `radial-gradient(circle at 35% 35%, ${color}22, ${color}08 60%, transparent)`,
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={
          state === 'listening'
            ? { boxShadow: [`0 0 20px 5px ${color}44`, `0 0 80px 30px ${color}99`, `0 0 20px 5px ${color}44`] }
            : state === 'speaking'
            ? { boxShadow: [`0 0 20px 5px ${color}44`, `0 0 60px 20px ${color}88`, `0 0 20px 5px ${color}44`] }
            : state === 'thinking'
            ? { boxShadow: [`0 0 20px 5px ${color}44`, `0 0 40px 15px ${color}66`, `0 0 20px 5px ${color}44`] }
            : { boxShadow: `0 0 30px 10px ${color}33` }
        }
        transition={
          state !== 'idle'
            ? { duration: state === 'speaking' ? 0.6 : 1.2, repeat: Infinity, ease: 'easeInOut' }
            : {}
        }
      >
        {/* inner core */}
        <motion.div
          className="absolute inset-0 m-auto rounded-full"
          style={{
            width: 60,
            height: 60,
            background: `radial-gradient(circle, ${color}, ${color}44)`,
          }}
          animate={
            state !== 'idle'
              ? { scale: [1, 1.3, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 1, repeat: state !== 'idle' ? Infinity : 0, ease: 'easeInOut' }}
        />

        {/* circuit lines decoration */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 160" fill="none">
          <circle cx="80" cy="80" r="70" stroke={color} strokeWidth="0.5" strokeDasharray="4 8" opacity="0.4" />
          <circle cx="80" cy="80" r="55" stroke={color} strokeWidth="0.5" strokeDasharray="2 12" opacity="0.3" />
          <line x1="80" y1="5" x2="80" y2="20" stroke={color} strokeWidth="1" opacity="0.5" />
          <line x1="80" y1="140" x2="80" y2="155" stroke={color} strokeWidth="1" opacity="0.5" />
          <line x1="5" y1="80" x2="20" y2="80" stroke={color} strokeWidth="1" opacity="0.5" />
          <line x1="140" y1="80" x2="155" y2="80" stroke={color} strokeWidth="1" opacity="0.5" />
        </svg>

        {/* J letter */}
        <div
          className="absolute inset-0 flex items-center justify-center text-2xl font-bold tracking-widest"
          style={{ color, textShadow: `0 0 20px ${color}`, fontFamily: 'Courier New' }}
        >
          J
        </div>
      </motion.button>

      <div className="text-center">
        <div className="text-xs tracking-widest" style={{ color }}>
          {ORB_LABELS[state]}
        </div>
        {state === 'idle' && (
          <div className="text-xs tracking-wider mt-1" style={{ color: '#2a5f80' }}>
            CLICK OR SPEAK
          </div>
        )}
      </div>
    </div>
  );
}
