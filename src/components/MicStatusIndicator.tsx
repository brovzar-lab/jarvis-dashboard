import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';

interface Props {
  wakeActive: boolean;
  commandListening: boolean;
  muted: boolean;
  onToggleMute: () => void;
}

export function MicStatusIndicator({ wakeActive, commandListening, muted, onToggleMute }: Props) {
  const label = muted
    ? 'MICROPHONE OFF'
    : commandListening
      ? 'LISTENING'
      : 'WAKE ACTIVE';

  const borderColor = muted
    ? 'rgba(255,80,80,0.35)'
    : commandListening
      ? 'rgba(0,212,255,0.5)'
      : 'rgba(0,212,255,0.1)';

  const iconColor = muted
    ? '#ff5050'
    : commandListening
      ? '#00d4ff'
      : 'rgba(0,180,220,0.4)';

  const glowShadow = muted
    ? '0 0 12px rgba(255,80,80,0.25)'
    : commandListening
      ? '0 0 16px rgba(0,212,255,0.35)'
      : '0 0 6px rgba(0,212,255,0.05)';

  const textColor = muted
    ? 'rgba(255,80,80,0.7)'
    : commandListening
      ? 'rgba(0,212,255,0.7)'
      : 'rgba(0,180,220,0.3)';

  const iconAnimate = !muted && commandListening
    ? { opacity: [1, 0.35, 1], scale: [1, 1.12, 1] }
    : !muted && wakeActive
      ? { opacity: [0.4, 0.18, 0.4] }
      : {};

  const iconDuration = commandListening ? 0.65 : 2.5;

  return (
    <button
      onClick={onToggleMute}
      aria-label={`${label.toLowerCase()} — tap to ${muted ? 'unmute' : 'mute'}`}
      className="fixed bottom-4 right-4 z-40 flex flex-col items-center gap-1"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 38,
          height: 38,
          background: 'rgba(2,11,24,0.88)',
          border: `1px solid ${borderColor}`,
          backdropFilter: 'blur(8px)',
          boxShadow: glowShadow,
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <motion.div
          animate={iconAnimate}
          transition={{ duration: iconDuration, repeat: Infinity, ease: 'easeInOut' }}
        >
          {muted
            ? <MicOff size={15} color={iconColor} strokeWidth={1.5} />
            : <Mic size={15} color={iconColor} strokeWidth={1.5} />
          }
        </motion.div>
      </div>
      <span
        className="tracking-widest"
        style={{ color: textColor, fontSize: '0.55rem', transition: 'color 0.3s ease' }}
      >
        {label}
      </span>
    </button>
  );
}
