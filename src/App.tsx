import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { VoiceOrb } from './components/VoiceOrb';
import { AgentGrid } from './components/AgentGrid';
import { ReviewPanel } from './components/ReviewPanel';
import { AgendaPanel } from './components/AgendaPanel';
import { ConversationHistory } from './components/ConversationHistory';
import { MetricsBar } from './components/MetricsBar';
import { TextInput } from './components/TextInput';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useDashboard } from './hooks/useDashboard';
import { askJarvis } from './services/jarvis-ai';
import { buildJarvisContext, isDemoMode } from './services/paperclip';
import { speak, stopSpeaking } from './services/tts';
import type { OrbState, ConversationEntry } from './types';

let entryCounter = 0;

export default function App() {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const convHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const isProcessingRef = useRef(false);

  const { data: dashboardData, isLoading } = useDashboard();

  const addEntry = (role: 'user' | 'jarvis', text: string) => {
    setConversation(prev => [...prev, {
      id: String(++entryCounter),
      role,
      text,
      timestamp: new Date(),
    }]);
    setLastUpdated(new Date());
  };

  const processQuery = useCallback(async (userText: string) => {
    if (!userText.trim() || isProcessingRef.current) return;
    isProcessingRef.current = true;

    addEntry('user', userText);
    convHistoryRef.current.push({ role: 'user', content: userText });

    setOrbState('thinking');
    stopSpeaking();

    const context = dashboardData
      ? buildJarvisContext(dashboardData)
      : 'Dashboard data unavailable — operating in limited mode.';

    try {
      const response = await askJarvis(userText, context, convHistoryRef.current.slice(-8));
      convHistoryRef.current.push({ role: 'assistant', content: response });

      addEntry('jarvis', response);
      setOrbState('speaking');
      await speak(response);
    } catch {
      const fallback = 'I encountered an error processing that request, sir.';
      addEntry('jarvis', fallback);
      setOrbState('speaking');
      await speak(fallback);
    } finally {
      isProcessingRef.current = false;
      setOrbState('idle');
    }
  }, [dashboardData]);

  const { isListening, isSupported, startListening } = useSpeechRecognition(processQuery);

  const handleOrbClick = () => {
    if (orbState === 'speaking') {
      stopSpeaking();
      setOrbState('idle');
      return;
    }
    if (orbState !== 'idle') return;

    if (isSupported) {
      setOrbState('listening');
      startListening();
    }
  };

  const currentOrbState: OrbState = isListening ? 'listening' : orbState;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#020b18', backgroundImage: 'linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      <div className="scanline" />

      {isDemoMode && (
        <div className="demo-badge tracking-widest">DEMO MODE</div>
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.1)', background: 'rgba(2,11,24,0.8)', backdropFilter: 'blur(10px)' }}
      >
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="text-sm tracking-widest font-bold text-jarvis"
          >
            J.A.R.V.I.S
          </motion.div>
          <div className="text-xs text-jarvis-dim tracking-widest hidden md:block">
            EXECUTIVE AI SYSTEM · PAPERCLIP INTELLIGENCE PLATFORM
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="status-dot active" />
            <span className="text-jarvis-dim">SYSTEMS ONLINE</span>
          </div>
          <div className="text-jarvis-dim">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            <span className="mx-1 opacity-30">·</span>
            <LiveClock />
          </div>
        </div>
      </div>

      {/* Metrics bar */}
      {dashboardData && <MetricsBar data={dashboardData} lastUpdated={lastUpdated} />}

      {/* Main layout */}
      <div className="flex-1 grid grid-cols-12 gap-3 p-4" style={{ minHeight: 0 }}>
        {/* Left: Agents */}
        <div className="col-span-3" style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {isLoading ? (
            <LoadingSkeleton label="AGENT STATUS" />
          ) : (
            <AgentGrid
              agents={dashboardData?.agents ?? []}
              activeIssues={dashboardData?.activeIssues ?? []}
            />
          )}
        </div>

        {/* Center: Orb + Conversation */}
        <div className="col-span-6 flex flex-col gap-3">
          {/* Orb */}
          <div
            className="panel-border corner-decoration rounded flex items-center justify-center relative overflow-hidden"
            style={{ minHeight: 240 }}
          >
            <div className="relative flex items-center justify-center" style={{ width: 320, height: 220 }}>
              <VoiceOrb state={currentOrbState} onClick={handleOrbClick} />
              {!isSupported && orbState === 'idle' && (
                <div
                  className="absolute bottom-0 text-center text-xs"
                  style={{ color: '#2a5f80', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
                >
                  VOICE UNAVAILABLE · USE TEXT INPUT
                </div>
              )}
            </div>
          </div>

          {/* Conversation */}
          <div
            className="flex-1 panel-border corner-decoration rounded flex flex-col"
            style={{ minHeight: 180, maxHeight: 'calc(100vh - 430px)' }}
          >
            <div className="flex-1 overflow-hidden p-0">
              <ConversationHistory entries={conversation} />
            </div>
            <TextInput onSubmit={processQuery} disabled={isProcessingRef.current} />
          </div>
        </div>

        {/* Right: Review + Agenda */}
        <div className="col-span-3 flex flex-col gap-3" style={{ maxHeight: 'calc(100vh - 160px)' }}>
          <div className="flex-1 min-h-0">
            {isLoading ? (
              <LoadingSkeleton label="PENDING REVIEW" />
            ) : (
              <ReviewPanel issues={dashboardData?.inReviewIssues ?? []} />
            )}
          </div>
          <div className="flex-1 min-h-0">
            {isLoading ? (
              <LoadingSkeleton label="TODAY'S AGENDA" />
            ) : (
              <AgendaPanel issues={dashboardData?.myInbox ?? []} />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-center px-6 py-2 text-xs text-jarvis-dim animate-flicker"
        style={{ borderTop: '1px solid rgba(0,212,255,0.05)' }}
      >
        PAPERCLIP INTELLIGENCE PLATFORM · EXECUTIVE DASHBOARD v1.0
      </div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));

  useState(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(interval);
  });

  return <span>{time}</span>;
}

function LoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="text-xs tracking-widest text-jarvis mb-3">{label}</div>
      <div className="glow-line" />
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-xs text-jarvis-dim tracking-widest"
        >
          LOADING...
        </motion.div>
      </div>
    </div>
  );
}
