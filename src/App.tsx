import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { VoiceOrb } from './components/VoiceOrb';
import { AgentGrid } from './components/AgentGrid';
import { AgentBehaviorsPanel } from './components/AgentBehaviorsPanel';
import { EmailPanel } from './components/EmailPanel';
import { CalendarPanel } from './components/CalendarPanel';
import { ObsidianPanel } from './components/ObsidianPanel';
import { ReviewPanel } from './components/ReviewPanel';
import { BlockedPanel } from './components/BlockedPanel';
import { WaitingOnMePanel } from './components/WaitingOnMePanel';
import { AgendaPanel } from './components/AgendaPanel';
import { PitchesPanel } from './components/PitchesPanel';
import { ConversationHistory } from './components/ConversationHistory';
import { MetricsBar } from './components/MetricsBar';
import { SuggestedMovesStrip } from './components/SuggestedMovesStrip';
import { TextInput } from './components/TextInput';
import { CommandConfirmation } from './components/CommandConfirmation';
import { MicStatusIndicator } from './components/MicStatusIndicator';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useWakeWord } from './hooks/useWakeWord';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import { useDashboard } from './hooks/useDashboard';
import { useCostTracker } from './hooks/useCostTracker';
import { useProactiveBriefing } from './hooks/useProactiveBriefing';
import { askJarvis } from './services/jarvis-ai';
import { askJarvisStreaming } from './services/jarvis-stream';
import { addClaudeUsage } from './services/cost-tracker';
import { buildJarvisContext, isDemoMode, getCompanyId } from './services/paperclip';
import { speak, stopSpeaking, unlockAudio } from './services/tts';
import { parseCommandResponse, executeCommand } from './services/command-executor';
import type { JarvisCommand } from './services/command-executor';
import type { OrbState, ConversationEntry } from './types';

const COMPANY_ID = getCompanyId();

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
  const [pendingCommand, setPendingCommand] = useState<JarvisCommand | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [visualAlerts, setVisualAlerts] = useState<string[]>([]);
  const [agentView, setAgentView] = useState<'grid' | 'behaviors'>('behaviors');
  const [leftTab, setLeftTab] = useState<'brief' | 'agents' | 'email' | 'calendar' | 'brain'>('brief');
  const convHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const pendingCommandRef = useRef<JarvisCommand | null>(null);
  const isProcessingRef = useRef(false);
  const initialHistoryRestoredRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());

  const updateActivity = () => { lastActivityRef.current = Date.now(); };

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

  const { data: dashboardData, isLoading, refetch: refreshDashboard } = useDashboard();
  const sessionCost = useCostTracker();
  const [newIssueIds, setNewIssueIds] = useState<Set<string>>(new Set());
  const prevIssueIdsRef = useRef<Set<string>>(new Set());

  // Detect newly appeared issues on each data refresh and update lastUpdated
  useEffect(() => {
    if (!dashboardData) return;
    setLastUpdated(new Date());
    const allCurrent = [
      ...dashboardData.inReviewIssues,
      ...dashboardData.blockedIssues,
      ...dashboardData.waitingOnMeIssues,
    ];
    const currentIds = new Set(allCurrent.map(i => i.id));
    if (prevIssueIdsRef.current.size > 0) {
      const newIds = new Set<string>();
      for (const id of currentIds) {
        if (!prevIssueIdsRef.current.has(id)) newIds.add(id);
      }
      if (newIds.size > 0) {
        setNewIssueIds(newIds);
        setTimeout(() => setNewIssueIds(new Set()), 1500);
      }
    }
    prevIssueIdsRef.current = currentIds;
  }, [dashboardData]);

  // Keep pendingCommandRef in sync for stale-closure-safe callbacks
  useEffect(() => { pendingCommandRef.current = pendingCommand; }, [pendingCommand]);

  // 15-second countdown auto-cancel when a command is pending
  const handleCancelRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!pendingCommand) { setConfirmCountdown(0); return; }
    setConfirmCountdown(15);
    const interval = setInterval(() => {
      setConfirmCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleCancelRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCommand]);

  const addEntry = (role: 'user' | 'jarvis', text: string) => {
    setConversation(prev => [...prev, {
      id: String(++entryCounter),
      role,
      text,
      timestamp: new Date(),
    }]);
    setLastUpdated(new Date());
  };

  // Proactive briefing — fires once per session (5s desktop, first-gesture mobile)
  const { isBriefing, skipBriefing } = useProactiveBriefing(dashboardData, conversation.length > 0, async (text) => {
    addEntry('jarvis', text);
    setOrbState('speaking');
    await speak(text);
    setOrbState('idle');
  });

  // Any keypress skips the briefing while it's playing
  useEffect(() => {
    if (!isBriefing) return;
    const onKeyDown = () => skipBriefing();
    window.addEventListener('keydown', onKeyDown, { once: true });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBriefing, skipBriefing]);

  const handleCancel = useCallback(async () => {
    setPendingCommand(null);
    pendingCommandRef.current = null;
    setConfirmCountdown(0);
    const msg = 'Understood, command cancelled, sir.';
    addEntry('jarvis', msg);
    setOrbState('speaking');
    await speak(msg);
    setOrbState('idle');
  }, []);

  handleCancelRef.current = handleCancel;

  const handleExecute = useCallback(async () => {
    const cmd = pendingCommandRef.current;
    if (!cmd) return;
    setPendingCommand(null);
    pendingCommandRef.current = null;
    setConfirmCountdown(0);
    setIsExecuting(true);

    if (isDemoMode) {
      setIsExecuting(false);
      const msg = 'Demo mode — action not executed, sir. Connect a live Paperclip workspace to enable command execution.';
      addEntry('jarvis', msg);
      setOrbState('speaking');
      await speak(msg);
      setOrbState('idle');
      return;
    }

    setOrbState('thinking');
    const result = await executeCommand(cmd, COMPANY_ID);
    setIsExecuting(false);
    const reply = result.success ? result.message : `Command failed, sir. ${result.message}`;
    convHistoryRef.current.push({ role: 'assistant', content: reply });
    addEntry('jarvis', reply);
    setOrbState('speaking');
    await speak(reply);
    setOrbState('idle');
  }, []);

  const processQuery = useCallback(async (userText: string) => {
    if (!userText.trim() || isProcessingRef.current) return;
    updateActivity();

    // Intercept execute/cancel when command confirmation is pending
    if (pendingCommandRef.current) {
      const lower = userText.trim().toLowerCase();
      const isAffirmative = ['execute', 'yes', 'yeah', 'yep', 'do it', 'confirm', 'go ahead', 'proceed', 'ok', 'okay'].some(w => lower === w || lower.startsWith(w + ' '));
      const isCancellation = ['cancel', 'no', 'nope', 'abort', 'stop', 'never mind', 'nevermind', 'forget it'].some(w => lower === w || lower.startsWith(w + ' '));
      if (isAffirmative) { handleExecute(); return; }
      if (isCancellation) { handleCancel(); return; }
    }

    isProcessingRef.current = true;

    addEntry('user', userText);
    convHistoryRef.current.push({ role: 'user', content: userText });

    setOrbState('thinking');
    stopSpeaking();

    const context = dashboardData
      ? buildJarvisContext(dashboardData, COMPANY_ID)
      : 'Dashboard data unavailable — operating in limited mode.';

    const jarvisEntryId = String(++entryCounter);
    let ttsChain = Promise.resolve();
    let firstSentence = true;
    let commandDetected = false;

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
          if (commandDetected) return; // suppress TTS for command JSON
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
          addClaudeUsage(usage.input_tokens, usage.output_tokens);
          setLastUpdated(new Date());

          const command = parseCommandResponse(fullText);
          if (command) {
            commandDetected = true;
            stopSpeaking();
            // Replace provisional entry with the confirmation text
            setConversation(prev => prev.map(e =>
              e.id === jarvisEntryId ? { ...e, text: command.confirmation } : e
            ));
            setPendingCommand(command);
            pendingCommandRef.current = command;
            setOrbState('speaking');
            speak(command.confirmation + ' Say execute to proceed, or cancel.').then(() => setOrbState('idle'));
          } else {
            setConversation(prev => prev.map(e =>
              e.id === jarvisEntryId ? { ...e, text: fullText } : e
            ));
            convHistoryRef.current.push({ role: 'assistant', content: fullText });
          }
        }
      );

      if (!commandDetected) await ttsChain;
    } catch (err) {
      // Streaming failed — fall back to the non-streaming path
      console.warn('Streaming failed, falling back to non-streaming:', err);
      setConversation(prev => prev.filter(e => e.id !== jarvisEntryId));

      try {
        const response = await askJarvis(userText, context, convHistoryRef.current.slice(-8));
        const command = parseCommandResponse(response);
        if (command) {
          setPendingCommand(command);
          pendingCommandRef.current = command;
          addEntry('jarvis', command.confirmation);
          setOrbState('speaking');
          await speak(command.confirmation + ' Say execute to proceed, or cancel.');
          setOrbState('idle');
        } else {
          convHistoryRef.current.push({ role: 'assistant', content: response });
          addEntry('jarvis', response);
          setOrbState('speaking');
          await speak(response);
          setOrbState('idle');
        }
      } catch (fallbackErr) {
        console.error('processQuery fallback error:', fallbackErr);
        const fallback = 'I encountered an unexpected error, sir. Please try again.';
        addEntry('jarvis', fallback);
        setOrbState('speaking');
        await speak(fallback);
        setOrbState('idle');
      }
    } finally {
      isProcessingRef.current = false;
      if (!commandDetected) setOrbState('idle');
    }
  }, [dashboardData, handleExecute, handleCancel]);

  const { isListening, isSupported, startListening } = useSpeechRecognition(processQuery);

  const { isListening: wakeListening } = useWakeWord(
    () => {
      unlockAudio();
      stopSpeaking(); // interrupt any active speech
      if (!isProcessingRef.current) {
        setOrbState('listening');
        startListening();
      }
    },
    !micMuted && (orbState === 'idle' || orbState === 'speaking') && !isProcessingRef.current,
  );

  useNotificationPolling(
    dashboardData,
    async (message) => {
      if (orbState !== 'idle') return;
      addEntry('jarvis', message);
      setOrbState('speaking');
      await speak(message);
      setOrbState('idle');
    },
    (message) => {
      setVisualAlerts(prev => [...prev, message]);
    },
    () => lastActivityRef.current,
  );

  const handleOrbClick = () => {
    // Unlock audio on every user tap so iOS AudioContext stays resumed
    unlockAudio();
    updateActivity();

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
    updateActivity();
    processQuery(text);
  }, [processQuery]);

  const currentOrbState: OrbState = isListening ? 'listening' : orbState;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#020b18', backgroundImage: 'linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      <div className="scanline" />

      {isDemoMode && (
        <div className="demo-badge tracking-widest">DEMO MODE</div>
      )}

      {/* Command confirmation overlay */}
      <CommandConfirmation
        command={pendingCommand}
        isExecuting={isExecuting}
        countdown={confirmCountdown}
        onExecute={handleExecute}
        onCancel={handleCancel}
      />

      {/* Skip briefing button — visible while auto-briefing is speaking */}
      {isBriefing && orbState === 'speaking' && (
        <button
          onClick={skipBriefing}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 text-xs tracking-widest transition-colors"
          style={{
            minHeight: 44,
            border: '1px solid rgba(0,212,255,0.6)',
            background: 'rgba(0,0,0,0.5)',
            color: '#00d4ff',
          }}
        >
          SKIP BRIEFING
        </button>
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
          <TimePeriodIndicator />
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
      {dashboardData && (
        <MetricsBar
          data={dashboardData}
          lastUpdated={lastUpdated}
          sessionCost={sessionCost}
          visualAlerts={visualAlerts}
          onDismissAlerts={() => setVisualAlerts([])}
        />
      )}

      {/* Main layout — scrollable on mobile, fixed-height 3-col on desktop */}
      <div className="flex-1 overflow-y-auto md:overflow-y-hidden grid grid-cols-1 md:grid-cols-12 gap-3 p-3 md:p-4" style={{ minHeight: 0 }}>

        {/* Center: Orb + Conversation — first on mobile, cols 5-9 on desktop */}
        <div className="col-span-1 md:col-span-5 md:col-start-5 order-first md:order-none flex flex-col gap-3">
          {/* Orb */}
          <div
            className="panel-border corner-decoration rounded flex items-center justify-center relative overflow-hidden"
            style={{ minHeight: 220 }}
          >
            {/* Ambient glow rings */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,212,255,0.04) 0%, transparent 70%)' }} />
            <div className="relative flex items-center justify-center" style={{ width: '100%', maxWidth: 360, height: 220 }}>
              {/* Left: live clock */}
              <div className="absolute left-4 bottom-4 text-right hidden md:block">
                <OrbClock />
                <div className="text-xs tracking-widest mt-0.5" style={{ color: '#0d2030', fontSize: '0.55rem' }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                </div>
              </div>
              <VoiceOrb state={currentOrbState} onClick={handleOrbClick} />
              {/* Right: state label */}
              <div className="absolute right-4 bottom-4 text-right hidden md:block">
                <div className="text-xs tracking-widest" style={{ color: '#0d2030', fontSize: '0.55rem' }}>STATE</div>
                <motion.div
                  key={currentOrbState}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs tracking-widest font-medium"
                  style={{ color: currentOrbState === 'idle' ? '#1a4060' : currentOrbState === 'listening' ? '#00d4ff' : currentOrbState === 'thinking' ? '#fbbf24' : '#34d399' }}
                >
                  {currentOrbState.toUpperCase()}
                </motion.div>
              </div>
              {wakeListening && (
                <motion.div
                  className="absolute top-2 right-2 flex items-center gap-1.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#00d4ff' }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-xs tracking-widest" style={{ color: '#2a5f80' }}>WAKE</span>
                </motion.div>
              )}
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

        {/* Left: Intel tabs — second on mobile, cols 1-4 on desktop */}
        <div className="col-span-1 md:col-span-4 md:col-start-1 order-2 md:order-none desktop-agents-panel flex flex-col gap-0">
          {/* Tab bar */}
          <div
            className="flex items-center gap-0 mb-0 flex-shrink-0"
            style={{ borderBottom: '1px solid #0a2a4a' }}
          >
            {(['brief', 'agents', 'email', 'calendar', 'brain'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className="flex-1 text-center py-1.5 text-xs tracking-widest transition-colors"
                style={{
                  color: leftTab === tab ? '#00d4ff' : '#2a5f80',
                  background: leftTab === tab ? 'rgba(0,212,255,0.06)' : 'transparent',
                  borderBottom: leftTab === tab ? '1px solid #00d4ff' : '1px solid transparent',
                  marginBottom: -1,
                  fontSize: '0.55rem',
                }}
              >
                {tab === 'brief' ? '◆' : ''}{tab === 'calendar' ? 'CAL' : tab === 'brain' ? 'BRAIN' : tab.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {leftTab === 'brief' ? (
              <BriefingPanel
                conversation={conversation}
                lastUpdated={lastUpdated}
                onAction={handleTextSubmit}
              />
            ) : leftTab === 'agents' ? (
              isLoading ? (
                <LoadingSkeleton label={agentView === 'behaviors' ? 'AGENT BEHAVIORS' : 'AGENT STATUS'} />
              ) : agentView === 'behaviors' ? (
                <AgentBehaviorsPanel
                  agents={dashboardData?.agents ?? []}
                  activeIssues={dashboardData?.activeIssues ?? []}
                  companyLabels={dashboardData?.companyLabels ?? {}}
                  onToggleView={() => setAgentView('grid')}
                />
              ) : (
                <AgentGrid
                  agents={dashboardData?.agents ?? []}
                  activeIssues={dashboardData?.activeIssues ?? []}
                  onToggleView={() => setAgentView('behaviors')}
                />
              )
            ) : leftTab === 'email' ? (
              <EmailPanel />
            ) : leftTab === 'calendar' ? (
              <CalendarPanel />
            ) : (
              <ObsidianPanel />
            )}
          </div>
        </div>

        {/* Right: Review + Blocked + Waiting + Agenda — stacked, scrollable, cols 10-12 on desktop */}
        <div className="col-span-1 md:col-span-3 md:col-start-10 order-3 md:order-none flex flex-col gap-3 desktop-side-panel">
          <div className="min-h-[100px]">
            {isLoading ? (
              <LoadingSkeleton label="PENDING REVIEW" />
            ) : (
              <ReviewPanel issues={dashboardData?.inReviewIssues ?? []} onRefresh={refreshDashboard} newIssueIds={newIssueIds} />
            )}
          </div>
          <div className="min-h-[90px]">
            {isLoading ? (
              <LoadingSkeleton label="BLOCKED" />
            ) : (
              <BlockedPanel issues={dashboardData?.blockedIssues ?? []} onRefresh={refreshDashboard} newIssueIds={newIssueIds} />
            )}
          </div>
          <div className="min-h-[90px]">
            {isLoading ? (
              <LoadingSkeleton label="YOUR CALL" />
            ) : (
              <WaitingOnMePanel issues={dashboardData?.waitingOnMeIssues ?? []} onRefresh={refreshDashboard} newIssueIds={newIssueIds} />
            )}
          </div>
          <div className="min-h-[90px]">
            {isLoading ? (
              <LoadingSkeleton label="LEMA PITCHES" />
            ) : (
              <PitchesPanel issues={dashboardData?.lemaPitches ?? []} />
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

      {/* Suggested next moves strip */}
      {dashboardData && (
        <SuggestedMovesStrip
          blocked={dashboardData.blockedIssues}
          review={dashboardData.inReviewIssues}
          waiting={dashboardData.waitingOnMeIssues}
          onAction={handleTextSubmit}
        />
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-center px-4 md:px-6 py-2 text-xs text-jarvis-dim animate-flicker"
        style={{ borderTop: '1px solid rgba(0,212,255,0.05)' }}
      >
        PAPERCLIP INTELLIGENCE PLATFORM · EXECUTIVE DASHBOARD v2.0
      </div>

      <MicStatusIndicator
        wakeActive={wakeListening}
        commandListening={isListening}
        muted={micMuted}
        onToggleMute={() => setMicMuted(m => !m)}
      />
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

function OrbClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="font-mono tracking-wider"
      style={{ color: '#1a4060', fontSize: '0.95rem', letterSpacing: '0.15em' }}
      animate={{ opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 4, repeat: Infinity }}
    >
      {time}
    </motion.div>
  );
}

function TimePeriodIndicator() {
  const hour = new Date().getHours();
  const period = hour < 12 ? 'MORNING' : hour < 17 ? 'MID-DAY' : 'END OF DAY';
  const periods = ['MORNING', 'MID-DAY', 'END OF DAY'];
  return (
    <div className="items-center gap-0.5 hidden md:flex">
      {periods.map(p => (
        <span
          key={p}
          className="px-2 py-0.5 text-xs tracking-widest transition-colors"
          style={{
            color: p === period ? '#00d4ff' : '#1a3040',
            border: p === period ? '1px solid rgba(0,212,255,0.25)' : '1px solid transparent',
            fontSize: '0.55rem',
          }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

interface BriefingPanelProps {
  conversation: ConversationEntry[];
  lastUpdated: Date;
  onAction: (text: string) => void;
}

function BriefingPanel({ conversation, lastUpdated, onAction }: BriefingPanelProps) {
  const hour = new Date().getHours();
  const periodLabel = hour < 12 ? 'MORNING CHECK-IN' : hour < 17 ? 'MID-DAY CHECK-IN' : 'END-OF-DAY BRIEF';
  const jarvisMessages = conversation.filter(e => e.role === 'jarvis');
  const CHIPS = [
    "What's blocking us right now?",
    "Show today's pending reviews",
    "Status of all agents",
    "What should I focus on next?",
  ];
  return (
    <div className="panel-border corner-decoration rounded h-full flex flex-col" style={{ padding: '10px 12px' }}>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <motion.span
          className="text-xs tracking-widest text-jarvis"
          style={{ fontSize: '0.6rem' }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          {periodLabel}
        </motion.span>
        <span className="text-xs tracking-widest" style={{ color: '#1a3040', fontSize: '0.55rem' }}>
          refreshed {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="glow-line flex-shrink-0" />
      <div className="flex-1 overflow-y-auto mt-2 space-y-3 min-h-0">
        {jarvisMessages.length > 0 ? (
          jarvisMessages.slice(-4).map(entry => (
            <div key={entry.id}>
              <div className="text-xs tracking-widest mb-1" style={{ color: '#1a4060', fontSize: '0.55rem' }}>
                {entry.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: '#4a9fc0', lineHeight: '1.7', fontSize: '0.72rem' }}>
                {entry.text}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="text-xs tracking-widest text-center"
              style={{ color: '#2a5f80', fontSize: '0.6rem' }}
            >
              AWAITING BRIEFING
            </motion.div>
            <div className="text-xs text-center leading-relaxed" style={{ color: '#1a3040', fontSize: '0.65rem' }}>
              Click the orb or ask Jarvis anything to start your session
            </div>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 mt-3 pt-2" style={{ borderTop: '1px solid rgba(0,212,255,0.06)' }}>
        <div className="text-xs tracking-widest mb-1.5" style={{ color: '#1a3040', fontSize: '0.55rem' }}>QUICK ACTIONS</div>
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => onAction(chip)}
              className="px-2 py-1 text-xs tracking-widest transition-all hover:opacity-80"
              style={{ border: '1px solid rgba(0,212,255,0.18)', color: '#2a5f80', background: 'transparent', fontSize: '0.55rem', borderRadius: 2 }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
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
