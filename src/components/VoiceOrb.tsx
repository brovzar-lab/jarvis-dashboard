import { motion } from 'framer-motion';
import type { OrbState } from '../types';

interface Props {
  state: OrbState;
  onClick: () => void;
  orbSize?: number;
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

export function VoiceOrb({ state, onClick, orbSize = 160 }: Props) {
  const color = ORB_COLORS[state];
  const ring1 = orbSize * 1.375;
  const ring2 = orbSize * 1.75;
  const core = orbSize * 0.375;

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* outer rings */}
      {state !== 'idle' && (
        <>
          <motion.div
            className="absolute rounded-full border opacity-20"
            style={{ borderColor: color, width: ring1, height: ring1 }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full border opacity-10"
            style={{ borderColor: color, width: ring2, height: ring2 }}
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
          width: orbSize,
          height: orbSize,
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
            width: core,
            height: core,
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
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${orbSize} ${orbSize}`} fill="none">
          <circle cx={orbSize/2} cy={orbSize/2} r={orbSize*0.4375} stroke={color} strokeWidth="0.5" strokeDasharray="4 8" opacity="0.4" />
          <circle cx={orbSize/2} cy={orbSize/2} r={orbSize*0.34} stroke={color} strokeWidth="0.5" strokeDasharray="2 12" opacity="0.3" />
          <line x1={orbSize/2} y1={orbSize*0.03} x2={orbSize/2} y2={orbSize*0.125} stroke={color} strokeWidth="1" opacity="0.5" />
          <line x1={orbSize/2} y1={orbSize*0.875} x2={orbSize/2} y2={orbSize*0.97} stroke={color} strokeWidth="1" opacity="0.5" />
          <line x1={orbSize*0.03} y1={orbSize/2} x2={orbSize*0.125} y2={orbSize/2} stroke={color} strokeWidth="1" opacity="0.5" />
          <line x1={orbSize*0.875} y1={orbSize/2} x2={orbSize*0.97} y2={orbSize/2} stroke={color} strokeWidth="1" opacity="0.5" />
        </svg>

        {/* J letter */}
        <div
          className="absolute inset-0 flex items-center justify-center font-bold tracking-widest"
          style={{ color, textShadow: `0 0 20px ${color}`, fontFamily: 'Courier New', fontSize: orbSize * 0.15 }}
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
