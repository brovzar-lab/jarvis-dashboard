import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { VoiceOrb } from './components/VoiceOrb';
import { AgentGrid } from './components/AgentGrid';
import { ReviewPanel } from './components/ReviewPanel';
import { BlockedPanel } from './components/BlockedPanel';
import { WaitingOnMePanel } from './components/WaitingOnMePanel';
import { AgendaPanel } from './components/AgendaPanel';
import { ConversationHistory } from './components/ConversationHistory';
import { MetricsBar } from './components/MetricsBar';
import { TextInput } from './components/TextInput';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useDashboard } from './hooks/useDashboard';
import { useCostTracker } from './hooks/useCostTracker';
import { useProactiveBriefing } from './hooks/useProactiveBriefing';
import { askJarvis } from './services/jarvis-ai';
import { askJarvisStreaming } from './services/jarvis-stream';
import { addClaudeUsage } from './services/cost-tracker';
import { buildJarvisContext, isDemoMode } from './services/paperclip';
import { speak, stopSpeaking, unlockAudio } from './services/tts';
import type { OrbState, ConversationEntry } from './types';

const CONV_STORAGE_KEY = 'jarvis_conversation_history';

let entryCounter = 0;

function loadConversation(): ConversationEntry[] {
  try {
    const saved = localStorage.getItem(CONV_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ConversationEntry[];
      return parsed.map(e => ({ ...e, timestamp: new Date(e.timestamp) })).slice(-20);
    }
  } catch {}
  return [];
}

export default function App() {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [conversation, setConversation] = useState<ConversationEntry[]>(loadConversation);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const convHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const isProcessingRef = useRef(false);
  const initialHistoryRestoredRef = useRef(false);

  // Restore convHistoryRef from persisted conversation once on mount
  useEffect(() => {
    if (initialHistoryRestoredRef.current) return;
    initialHistoryRestoredRef.current = true;
    convHistoryRef.current = conversation.map(e => ({
      role: e.role === 'jarvis' ? 'assistant' : 'user' as 'user' | 'assistant',
      content: e.text,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist conversation to localStorage on every change
  useEffect(() => {
    if (conversation.length > 0) {
      localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(conversation.slice(-20)));
    }
  }, [conversation]);

  const { data: dashboardData, isLoading } = useDashboard();
  const sessionCost = useCostTracker();

  const addEntry = (role: 'user' | 'jarvis', text: string) => {
    setConversation(prev => [...prev, {
      id: String(++entryCounter),
      role,
      text,
      timestamp: new Date(),
    }]);
    setLastUpdated(new Date());
  };

  // Proactive briefing — fires once per session, 2s after dashboard data arrives
  useProactiveBriefing(dashboardData, conversation.length > 0, async (text) => {
    addEntry('jarvis', text);
    setOrbState('speaking');
    await speak(text);
    setOrbState('idle');
  });

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

    const jarvisEntryId = String(++entryCounter);
    let ttsChain = Promise.resolve();
    let firstSentence = true;

    try {
      // Add a provisional entry that fills in as streaming arrives
      setConversation(prev => [...prev, {
        id: jarvisEntryId,
        role: 'jarvis' as const,
        text: '…',
        timestamp: new Date(),
      }]);

      await askJarvisStreaming(
        userText,
        context,
        convHistoryRef.current.slice(-8),
        (sentence) => {
          if (firstSentence) {
            firstSentence = false;
            setOrbState('speaking');
          }
          setConversation(prev => prev.map(e =>
            e.id === jarvisEntryId ? { ...e, text: (e.text === '…' ? '' : e.text + ' ') + sentence } : e
          ));
          ttsChain = ttsChain.then(() => speak(sentence));
        },
        (fullText, usage) => {
          setConversation(prev => prev.map(e =>
            e.id === jarvisEntryId ? { ...e, text: fullText } : e
          ));
          convHistoryRef.current.push({ role: 'assistant', content: fullText });
          setLastUpdated(new Date());
          addClaudeUsage(usage.input_tokens, usage.output_tokens);
        }
      );

      await ttsChain;
    } catch (err) {
      // Streaming failed — fall back to the non-streaming path
      console.warn('Streaming failed, falling back to non-streaming:', err);
      setConversation(prev => prev.filter(e => e.id !== jarvisEntryId));

      try {
        const response = await askJarvis(userText, context, convHistoryRef.current.slice(-8));
        convHistoryRef.current.push({ role: 'assistant', content: response });
        addEntry('jarvis', response);
        setOrbState('speaking');
        await speak(response);
      } catch (fallbackErr) {
        console.error('processQuery fallback error:', fallbackErr);
        const fallback = 'I encountered an unexpected error, sir. Please try again.';
        addEntry('jarvis', fallback);
        setOrbState('speaking');
        await speak(fallback);
      }
    } finally {
      isProcessingRef.current = false;
      setOrbState('idle');
    }
  }, [dashboardData]);

  const { isListening, isSupported, startListening } = useSpeechRecognition(processQuery);

  const handleOrbClick = () => {
    // Unlock audio on every user tap so iOS AudioContext stays resumed
    unlockAudio();

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

  const handleTextSubmit = useCallback((text: string) => {
    // Unlock audio from text submit gesture too
    unlockAudio();
    processQuery(text);
  }, [processQuery]);

  const currentOrbState: OrbState = isListening ? 'listening' : orbState;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#020b18', backgroundImage: 'linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      <div className="scanline" />

      {isDemoMode && (
        <div className="demo-badge tracking-widest">DEMO MODE</div>
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 md:px-6 py-3"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.1)', background: 'rgba(2,11,24,0.8)', backdropFilter: 'blur(10px)' }}
      >
        <div className="flex items-center gap-3 md:gap-4">
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
        <div className="flex items-center gap-3 md:gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="status-dot active" />
            <span className="text-jarvis-dim hidden sm:inline">SYSTEMS ONLINE</span>
          </div>
          <div className="text-jarvis-dim">
            <span className="hidden sm:inline">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}<span className="mx-1 opacity-30">·</span></span>
            <LiveClock />
          </div>
        </div>
      </div>

      {/* Metrics bar */}
      {dashboardData && <MetricsBar data={dashboardData} lastUpdated={lastUpdated} sessionCost={sessionCost} />}

      {/* Main layout — scrollable on mobile, fixed-height 3-col on desktop */}
      <div className="flex-1 overflow-y-auto md:overflow-y-hidden grid grid-cols-1 md:grid-cols-12 gap-3 p-3 md:p-4" style={{ minHeight: 0 }}>

        {/* Center: Orb + Conversation — first on mobile */}
        <div className="col-span-1 md:col-span-6 order-first md:order-none flex flex-col gap-3">
          {/* Orb */}
          <div
            className="panel-border corner-decoration rounded flex items-center justify-center relative overflow-hidden"
            style={{ minHeight: 220 }}
          >
            <div className="relative flex items-center justify-center" style={{ width: '100%', maxWidth: 320, height: 220 }}>
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
            className="flex-1 panel-border corner-decoration rounded flex flex-col desktop-convo-panel"
            style={{ minHeight: 200 }}
          >
            <div className="flex-1 overflow-hidden p-0">
              <ConversationHistory entries={conversation} />
            </div>
            <TextInput onSubmit={handleTextSubmit} disabled={isProcessingRef.current} />
          </div>
        </div>

        {/* Left: Agents — second on mobile */}
        <div className="col-span-1 md:col-span-3 order-2 md:order-none desktop-agents-panel">
          {isLoading ? (
            <LoadingSkeleton label="AGENT STATUS" />
          ) : (
            <AgentGrid
              agents={dashboardData?.agents ?? []}
              activeIssues={dashboardData?.activeIssues ?? []}
            />
          )}
        </div>

        {/* Right: Review + Blocked + Waiting + Agenda — stacked, scrollable */}
        <div className="col-span-1 md:col-span-3 order-3 md:order-none flex flex-col gap-3 desktop-side-panel">
          <div className="min-h-[100px]">
            {isLoading ? (
              <LoadingSkeleton label="PENDING REVIEW" />
            ) : (
              <ReviewPanel issues={dashboardData?.inReviewIssues ?? []} />
            )}
          </div>
          <div className="min-h-[90px]">
            {isLoading ? (
              <LoadingSkeleton label="BLOCKED" />
            ) : (
              <BlockedPanel issues={dashboardData?.blockedIssues ?? []} />
            )}
          </div>
          <div className="min-h-[90px]">
            {isLoading ? (
              <LoadingSkeleton label="YOUR CALL" />
            ) : (
              <WaitingOnMePanel issues={dashboardData?.waitingOnMeIssues ?? []} />
            )}
          </div>
          <div className="min-h-[90px]">
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
        className="flex items-center justify-center px-4 md:px-6 py-2 text-xs text-jarvis-dim animate-flicker"
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
