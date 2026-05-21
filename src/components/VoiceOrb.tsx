import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { OrbState } from '../types';

interface Props {
  state: OrbState;
  onClick: () => void;
  orbSize?: number;
  sessionCost?: number;
}

const STATE_CONFIG: Record<OrbState, { color: string; label: string; pulseDur: number }> = {
  idle:      { color: '#00d4ff', label: '@ IDLE',       pulseDur: 3.5 },
  listening: { color: '#00e8ff', label: '@ LISTENING',  pulseDur: 1.0 },
  thinking:  { color: '#a855f7', label: '@ PROCESSING', pulseDur: 1.5 },
  speaking:  { color: '#00ff88', label: '@ SPEAKING',   pulseDur: 0.65 },
};

function useClockTick() {
  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')} : ${String(d.getMinutes()).padStart(2,'0')} : ${String(d.getSeconds()).padStart(2,'0')}`;
  };
  const [t, setT] = useState(now);
  useEffect(() => { const id = setInterval(() => setT(now()), 1000); return () => clearInterval(id); }, []);
  return t;
}

export function VoiceOrb({ state, onClick, orbSize = 280, sessionCost }: Props) {
  const { color, label, pulseDur } = STATE_CONFIG[state];
  const s = orbSize;
  const cx = s / 2;
  const cy = s / 2;
  const clock = useClockTick();
  const isActive = state !== 'idle';

  const outerR  = s * 0.462;
  const midR    = s * 0.375;
  const innerR  = s * 0.198;
  const coreR   = s * 0.088;
  const ringR   = s * 0.283;

  const gradId  = `jcg-${state}`;
  const bgGId   = `jbg-${state}`;
  const glowFId = `jgf-${state}`;

  const majorAngles = Array.from({ length: 12 }, (_, i) => i * 30);
  const minorAngles = Array.from({ length: 72 }, (_, i) => i * 5).filter(a => a % 30 !== 0);

  const mkTick = (a: number, rOuter: number, len: number) => {
    const rad = (a - 90) * Math.PI / 180;
    return {
      x1: cx + Math.cos(rad) * (rOuter - len),
      y1: cy + Math.sin(rad) * (rOuter - len),
      x2: cx + Math.cos(rad) * rOuter,
      y2: cy + Math.sin(rad) * rOuter,
    };
  };

  const rp1 = ringR / s * 100;
  const rp2 = ringR * 0.87 / s * 100;
  const rp3 = ringR * 0.73 / s * 100;

  const costStr = sessionCost != null ? `$${sessionCost.toFixed(3)}` : '–';

  // Text positions inside the 4 quadrants of the circle
  const qx1 = cx - outerR * 0.50;
  const qx2 = cx + outerR * 0.50;
  const qy1 = cy - outerR * 0.53;
  const qy2 = cy - outerR * 0.40;
  const qy3 = cy + outerR * 0.46;
  const qy4 = cy + outerR * 0.59;

  // Radar sweep sector path (25° arc from 12 o'clock)
  const sweepR = innerR - 3;
  const sweepEndX = cx + sweepR * Math.sin(25 * Math.PI / 180);
  const sweepEndY = cy - sweepR * Math.cos(25 * Math.PI / 180);
  const radarPath = `M ${cx} ${cy} L ${cx} ${cy - sweepR} A ${sweepR} ${sweepR} 0 0 1 ${sweepEndX} ${sweepEndY} Z`;

  return (
    <div className="flex flex-col items-center select-none">
      <div
        role="button"
        tabIndex={0}
        className="relative"
        style={{ width: s, height: s, cursor: 'pointer' }}
        onClick={onClick}
        onKeyDown={e => e.key === 'Enter' && onClick()}
      >
        {/* State-driven outer glow */}
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          animate={isActive ? {
            boxShadow: [
              `0 0 ${s*0.07}px ${s*0.03}px ${color}33`,
              `0 0 ${s*0.24}px ${s*0.09}px ${color}5a`,
              `0 0 ${s*0.07}px ${s*0.03}px ${color}33`,
            ],
          } : { boxShadow: `0 0 ${s*0.07}px ${s*0.03}px ${color}26` }}
          transition={{ duration: pulseDur, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* 3D orbital rings */}
        <div className="absolute inset-0" style={{ perspective: `${s * 2.5}px` }}>
          {[
            { pct: rp1, anim: 'jarvis-orbital-1', dur: '11s',  op: 0.40 },
            { pct: rp2, anim: 'jarvis-orbital-2', dur: '16s',  op: 0.30, rev: true },
            { pct: rp3, anim: 'jarvis-orbital-3', dur: '22s',  op: 0.24 },
          ].map(({ pct, anim, dur, op, rev }) => (
            <div
              key={anim}
              style={{
                position: 'absolute',
                borderRadius: '50%',
                border: `1px solid ${color}`,
                opacity: op,
                top:    `${50 - pct}%`,
                left:   `${50 - pct}%`,
                width:  `${pct * 2}%`,
                height: `${pct * 2}%`,
                animation: `${anim} ${dur} linear infinite${rev ? ' reverse' : ''}`,
              }}
            />
          ))}
        </div>

        {/* SVG — all 2D geometry and labels */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={s} height={s}
          viewBox={`0 0 ${s} ${s}`}
          fill="none"
          style={{ zIndex: 10 }}
        >
          <defs>
            <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="white" stopOpacity="0.92" />
              <stop offset="28%"  stopColor={color} stopOpacity="0.88" />
              <stop offset="68%"  stopColor={color} stopOpacity="0.20" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={bgGId} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={color} stopOpacity="0.07" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
            <filter id={glowFId}>
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Soft background fill */}
          <circle cx={cx} cy={cy} r={innerR * 1.7} fill={`url(#${bgGId})`} />

          {/* Outer dashed ring */}
          <circle cx={cx} cy={cy} r={outerR} stroke={color} strokeWidth="0.5" strokeDasharray="1.5 8" opacity="0.30" />

          {/* Tick marks */}
          {majorAngles.map(a => { const t = mkTick(a, outerR, 9); return <line key={a} {...t} stroke={color} strokeWidth="1.5" opacity="0.50" />; })}
          {minorAngles.map(a => { const t = mkTick(a, outerR, 3.5); return <line key={a} {...t} stroke={color} strokeWidth="0.5" opacity="0.20" />; })}

          {/* Mid ring */}
          <circle cx={cx} cy={cy} r={midR} stroke={color} strokeWidth="0.5" strokeDasharray="2.5 7" opacity="0.15" />

          {/* Inner ring */}
          <circle cx={cx} cy={cy} r={innerR} stroke={color} strokeWidth="0.8" opacity="0.26" />

          {/* Cardinal dots on inner ring */}
          {[0, 90, 180, 270].map(a => {
            const rad = (a - 90) * Math.PI / 180;
            return <circle key={a} cx={cx + Math.cos(rad) * innerR} cy={cy + Math.sin(rad) * innerR} r={2.2} fill={color} opacity="0.58" />;
          })}

          {/* Cross guides inner→outer */}
          {[0, 90, 180, 270].map(a => {
            const rad = (a - 90) * Math.PI / 180;
            return <line key={a}
              x1={cx + Math.cos(rad) * innerR} y1={cy + Math.sin(rad) * innerR}
              x2={cx + Math.cos(rad) * outerR} y2={cy + Math.sin(rad) * outerR}
              stroke={color} strokeWidth="0.4" opacity="0.10" />;
          })}

          {/* Radar sweep (active states only) */}
          {isActive && (
            <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'jarvis-scan-arc 4s linear infinite' }}>
              <path d={radarPath} fill={`${color}14`} />
              <line x1={cx} y1={cy} x2={cx} y2={cy - sweepR} stroke={color} strokeWidth="0.8" opacity="0.45" />
            </g>
          )}

          {/* Arc reactor core */}
          <circle cx={cx} cy={cy} r={coreR * 1.9} fill={color} opacity="0.055" />
          <circle cx={cx} cy={cy} r={coreR} fill={`url(#${gradId})`} filter={`url(#${glowFId})`} />
          <circle cx={cx} cy={cy} r={2.5} fill="white" opacity="0.94" />

          {/* ── TEXT OVERLAYS ── */}

          {/* J.A.R.V.I.S. */}
          <text x={cx} y={cy - outerR * 0.60} textAnchor="middle"
            fill={color} fontSize={s * 0.056} fontFamily="'Courier New', monospace"
            letterSpacing="5" opacity="0.56">J.A.R.V.I.S</text>

          {/* Clock */}
          <text x={cx} y={cy + s * 0.035} textAnchor="middle"
            fill={color} fontSize={s * 0.088} fontFamily="'Courier New', monospace"
            fontWeight="300" letterSpacing="1" opacity="0.60">{clock}</text>

          {/* State */}
          <text x={cx} y={cy + innerR * 1.38} textAnchor="middle"
            fill={color} fontSize={s * 0.037} fontFamily="'Courier New', monospace"
            letterSpacing="3" opacity="0.38">{label}</text>

          {state === 'idle' && (
            <text x={cx} y={cy + innerR * 1.75} textAnchor="middle"
              fill={color} fontSize={s * 0.029} fontFamily="'Courier New', monospace"
              opacity="0.20">SAY "JARVIS" OR CLICK</text>
          )}

          {/* Corner data — quadrant positions inside the circle */}
          <text x={qx1} y={qy1} textAnchor="middle" fill={color} fontSize={s * 0.035} fontFamily="'Courier New', monospace" opacity="0.30">COGNITIVE CORE</text>
          <text x={qx1} y={qy2} textAnchor="middle" fill={color} fontSize={s * 0.029} fontFamily="'Courier New', monospace" opacity="0.20">v 14.0</text>

          <text x={qx2} y={qy1} textAnchor="middle" fill={color} fontSize={s * 0.035} fontFamily="'Courier New', monospace" opacity="0.30">STATE {state.toUpperCase()}</text>
          <text x={qx2} y={qy2} textAnchor="middle" fill={color} fontSize={s * 0.029} fontFamily="'Courier New', monospace" opacity="0.20">NOMINAL</text>

          <text x={qx1} y={qy3} textAnchor="middle" fill={color} fontSize={s * 0.029} fontFamily="'Courier New', monospace" opacity="0.20">UPLINK ● SECURE</text>
          <text x={qx1} y={qy4} textAnchor="middle" fill={color} fontSize={s * 0.026} fontFamily="'Courier New', monospace" opacity="0.16">Claude 4.6</text>

          <text x={qx2} y={qy3} textAnchor="middle" fill={color} fontSize={s * 0.029} fontFamily="'Courier New', monospace" opacity="0.20">SESSION {costStr}</text>
          <text x={qx2} y={qy4} textAnchor="middle" fill={color} fontSize={s * 0.026} fontFamily="'Courier New', monospace" opacity="0.16">SYNC ■</text>
        </svg>
      </div>
    </div>
  );
}
