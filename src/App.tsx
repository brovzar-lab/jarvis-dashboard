import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceOrb } from './components/VoiceOrb';
import { AgentGrid } from './components/AgentGrid';
import { AgentBehaviorsPanel } from './components/AgentBehaviorsPanel';
import { EmailPanel } from './components/EmailPanel';
import { CalendarPanel } from './components/CalendarPanel';
import { ObsidianPanel } from './components/ObsidianPanel';
import { RightIssuesTabs } from './components/RightIssuesTabs';
import { AgendaPanel } from './components/AgendaPanel';
import { PitchReviewPanel } from './components/PitchReviewPanel';
import { usePitchReview } from './hooks/usePitchReview';
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
import { useEmail } from './hooks/useEmail';
import { useCalendar } from './hooks/useCalendar';
import { useCostTracker } from './hooks/useCostTracker';
import { useProactiveBriefing } from './hooks/useProactiveBriefing';
import { useCardAction } from './hooks/useCardAction';
import { askJarvis } from './services/jarvis-ai';
import { askJarvisStreaming } from './services/jarvis-stream';
import { addClaudeUsage } from './services/cost-tracker';
import { buildJarvisContext, isDemoMode, getCompanyId } from './services/paperclip';
import { fetchObsidian, searchEmails, searchObsidian } from './services/integrations';
import type { ObsidianNote } from './services/integrations';
import { speak, stopSpeaking, unlockAudio, setVoiceParams, getVoiceParams } from './services/tts';
import type { TtsVoiceParams } from './services/tts';
import { tryStartMorningTheme, stopMorningTheme, isMorningThemePlaying, duckForTts, unduckFromTts, duckForMic, unduckFromMic } from './services/morning-theme';
import { parseCommandResponse, executeCommand } from './services/command-executor';
import type { JarvisCommand } from './services/command-executor';
import type { OrbState, ConversationEntry, Issue, ActionItem, ContextCard, ContextCardKind } from './types';

const COMPANY_ID = getCompanyId();

const PITCH_TRIGGERS = [
  'pitch me the new projects',
  "pitch me what's in the gate",
  'pitch me whats in the gate',
  'run the development gate',
  "what's pending review",
  'whats pending review',
];

const CONV_STORAGE_KEY = 'jarvis_conversation_history';
const ITEMS_STORAGE_KEY = 'jarvis_action_items';

let entryCounter = 0;

const ACTION_TRIGGERS = [
  /\byou (need|should|must|have|'ll|will) (to )?(call|email|contact|message|text|reach out|follow up|get back|respond|reply|send|review|sign|prepare|schedule|check|approve|confirm|update|discuss|address|handle|look at|go over|take care of)\b/i,
  /\byou (need to|should|must|have to|'ll (need|want) to|want to|are going to|'re going to)\b/i,
  /\b(don't forget (to )?|make sure (to |you )|be sure to|remember to)\b/i,
  /\b(get back to|follow up with|reach out to|respond to|reply to|circle back with)\b/i,
  /\bi('d| would) (recommend|suggest|advise)\b/i,
  /\bit('s| is) worth (reviewing|checking|following up|reaching out|calling|noting)\b/i,
  /\b(priority|prioritize|first thing|critical|urgent|before your (meeting|call|next))\b/i,
];

const ACTION_PREAMBLES = [
  /^(you need to|you should|you must|you have to|you'll need to|you'll want to|you will want to|you are going to|you're going to|you want to)\s+/i,
  /^(don't forget to|don't forget |make sure to|make sure you|be sure to|remember to)\s+/i,
  /^(i('d| would) (recommend|suggest|advise)( you| that you)?( to)?)\s+/i,
  /^(it('s| is) worth (a moment to )?|it would be worth )\s*/i,
];

function extractActionItems(text: string): string[] {
  const items: string[] = [];
  const sentences = text.match(/[^.!?\n]+[.!?]*/g) ?? [];
  for (let raw of sentences) {
    const s = raw.trim();
    if (!s || s.length < 20) continue;
    if (!ACTION_TRIGGERS.some(p => p.test(s))) continue;
    let item = s;
    for (const p of ACTION_PREAMBLES) {
      const cleaned = item.replace(p, '');
      if (cleaned !== item) { item = cleaned; break; }
    }
    item = item
      .replace(/,?\s*(sir|as soon as (possible|you can)|asap|right away|immediately|at your earliest convenience)\.?$/gi, '')
      .replace(/[.!?]+$/, '')
      .trim();
    if (item.length > 8 && item.length <= 150) {
      item = item.charAt(0).toUpperCase() + item.slice(1);
      if (!items.includes(item)) items.push(item);
    }
  }
  return items;
}

function loadActionItems(): ActionItem[] {
  try {
    const saved = localStorage.getItem(ITEMS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ActionItem[];
      return parsed.map(e => ({ ...e, timestamp: new Date(e.timestamp) }));
    }
  } catch {}
  return [];
}

const CTX_CARD_RE = /\[CTX_CARD\]([\s\S]*?)\[\/CTX_CARD\]/;
const VALID_KINDS: ContextCardKind[] = ['movie', 'weather', 'project', 'person', 'issue', 'generic'];

function parseContextCard(text: string): { card: ContextCard | null; cleanText: string } {
  const cleanText = text.replace(/\[CTX_CARD\][\s\S]*?\[\/CTX_CARD\]/g, '').trim();
  let card: ContextCard | null = null;
  const match = CTX_CARD_RE.exec(text);
  if (match) {
    try {
      const data = JSON.parse(match[1].trim()) as {
        kind?: string;
        title?: string;
        subtitle?: string;
        meta?: Record<string, string>;
      };
      if (data.title) {
        card = {
          id: String(Date.now()),
          kind: VALID_KINDS.includes(data.kind as ContextCardKind) ? (data.kind as ContextCardKind) : 'generic',
          title: data.title,
          subtitle: data.subtitle,
          meta: data.meta,
          timestamp: new Date(),
        };
      }
    } catch { /* malformed JSON — ignore */ }
  }
  return { card, cleanText };
}

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
  const [actionItems, setActionItems] = useState<ActionItem[]>(loadActionItems);
  const [contextCard, setContextCard] = useState<ContextCard | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [voiceParams, setVoiceParamsState] = useState<TtsVoiceParams>(() => getVoiceParams());
  const [voiceTunerOpen, setVoiceTunerOpen] = useState(false);
  const [voiceTunerPos, setVoiceTunerPos] = useState({ top: 0, right: 0 });
  const voiceTunerRef = useRef<HTMLDivElement>(null);
  const voiceButtonRef = useRef<HTMLButtonElement>(null);
  const startListeningRef = useRef<() => void>(() => {});
  const convHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const pendingCommandRef = useRef<JarvisCommand | null>(null);
  const isProcessingRef = useRef(false);
  const initialHistoryRestoredRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());

  const updateActivity = () => { lastActivityRef.current = Date.now(); };

  useEffect(() => {
    if (!voiceTunerOpen) return;
    const handle = (e: MouseEvent) => {
      if (voiceTunerRef.current && !voiceTunerRef.current.contains(e.target as Node)) {
        setVoiceTunerOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [voiceTunerOpen]);

  const updateVoiceParam = useCallback((key: keyof TtsVoiceParams, value: number) => {
    setVoiceParamsState(prev => {
      const updated = { ...prev, [key]: value };
      setVoiceParams(updated);
      return updated;
    });
  }, []);

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

  // Persist action items to localStorage
  useEffect(() => {
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(actionItems));
  }, [actionItems]);

  const { data: dashboardData, isLoading, refetch: refreshDashboard } = useDashboard();
  const { data: emails = [] } = useEmail();
  const { data: calendarEvents = [] } = useCalendar();
  const sessionCost = useCostTracker();
  const [obsidianNotes, setObsidianNotes] = useState<ObsidianNote[]>([]);
  const [memoryContext, setMemoryContext] = useState('');

  useEffect(() => {
    fetchObsidian().then(setObsidianNotes);
    // Refresh vault notes every 5 minutes
    const interval = setInterval(() => fetchObsidian().then(setObsidianNotes), 300_000);
    return () => clearInterval(interval);
  }, []);

  // Pre-warm mic permission BEFORE starting music.
  // Without this, SpeechRecognition.start() triggers the browser permission dialog
  // mid-playback, which interrupts audio on Chrome. By requesting permission first,
  // the dialog fires before music starts, and subsequent recognition.start() calls
  // are silent (permission already granted).
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval>;

    async function initAudio() {
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
        } catch { /* permission denied — continue without mic */ }
      }
      // Mic permission resolved (granted or denied) — safe to start music
      tryStartMorningTheme();
      setMicReady(true);
      pollInterval = setInterval(() => {
        const playing = isMorningThemePlaying();
        setMusicPlaying(playing);
        if (!playing) clearInterval(pollInterval);
      }, 1000);
    }

    initAudio();
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, []);

  // Load persistent memory context from Obsidian once on mount
  useEffect(() => {
    fetch('/api/session-context')
      .then(r => r.ok ? r.json() : null)
      .then((data: { memoryContext?: string } | null) => {
        if (data?.memoryContext) setMemoryContext(data.memoryContext);
      })
      .catch(() => { /* Obsidian offline — degrade gracefully */ });
  }, []);
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

  const addActionItems = (text: string) => {
    const items = extractActionItems(text);
    if (items.length === 0) return;
    setActionItems(prev => [
      ...items.map(t => ({ id: String(++entryCounter), text: t, timestamp: new Date() })),
      ...prev,
    ].slice(0, 20));
  };

  const {
    session: pitchSession,
    sessionRef: pitchSessionRef,
    startPitchReview,
    handleVerdict: handlePitchVerdict,
    abortSession: abortPitchSession,
    pitchCurrent,
    speakMoreDetail: speakPitchDetail,
  } = usePitchReview({
    setOrbState,
    onReadyForVerdict: () => startListeningRef.current(),
    addEntry,
  });

  const handleDismissItem = useCallback((id: string) => {
    setActionItems(prev => prev.filter(a => a.id !== id));
  }, []);

  // Proactive briefing — fires once per session via Claude, leading with calendar/email
  const { isBriefing, skipBriefing } = useProactiveBriefing(dashboardData, conversation.length > 0, async () => {
    if (!dashboardData) return;

    const baseContext = buildJarvisContext(dashboardData, COMPANY_ID, obsidianNotes);

    const emailContext = emails.length > 0
      ? `\nGMAIL INBOX (${emails.filter((e: { unread: boolean }) => e.unread).length} unread):\n` +
        emails.slice(0, 12).map((e: { unread: boolean; priority: string; inInbox?: boolean; from: string; subject: string; time: string; preview: string }) =>
          `- [${e.unread ? 'UNREAD' : 'READ'}${e.priority === 'high' ? ' HIGH-PRI' : ''}] From: ${e.from} | Subject: ${e.subject} | ${e.time} | ${e.preview.slice(0, 60)}`
        ).join('\n')
      : '\nGMAIL: No messages loaded yet.';

    const calendarContext = calendarEvents.length > 0
      ? `\nCALENDAR TODAY (${calendarEvents.filter(e => !e.past).length} upcoming events):\n` +
        calendarEvents.map(e => `- [${e.past ? 'PAST' : 'UPCOMING'}] ${e.title} at ${e.time}${e.duration ? ` (${e.duration})` : ''}${e.attendees ? ` — ${e.attendees} attendees` : ''}`).join('\n')
      : '\nCALENDAR: No events loaded yet.';

    const briefContext = baseContext + emailContext + calendarContext;

    const hour = new Date().getHours();
    const timePeriod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const briefQuery = `Deliver my proactive ${timePeriod} briefing. PRIORITY ORDER: (1) calendar — what meetings are coming up today and when; (2) email — any urgent or high-priority messages; (3) one concise sentence on Paperclip operational status only if critical. Do NOT enumerate agents, blocked counts, or issue lists — I can see those on the dashboard. Speak naturally as JARVIS. Under 90 words total. No questions.`;

    const briefEntryId = String(++entryCounter);
    let ttsChain = Promise.resolve();
    let firstSentence = true;

    setConversation(prev => [...prev, {
      id: briefEntryId,
      role: 'jarvis' as const,
      text: '…',
      timestamp: new Date(),
    }]);

    try {
      await askJarvisStreaming(
        briefQuery,
        briefContext,
        [],
        (sentence) => {
          if (sentence.includes('[CTX_CARD]') || sentence.includes('[/CTX_CARD]')) return;
          if (firstSentence) { firstSentence = false; setOrbState('speaking'); }
          setConversation(prev => prev.map(e =>
            e.id === briefEntryId ? { ...e, text: (e.text === '…' ? '' : e.text + ' ') + sentence } : e
          ));
          ttsChain = ttsChain.then(() => speak(sentence));
        },
        (fullText, usage) => {
          addClaudeUsage(usage.input_tokens, usage.output_tokens);
          const { cleanText } = parseContextCard(fullText);
          setConversation(prev => prev.map(e =>
            e.id === briefEntryId ? { ...e, text: cleanText } : e
          ));
          convHistoryRef.current.push({ role: 'assistant', content: cleanText });
          addActionItems(cleanText);
        },
        memoryContext || undefined,
      );
      await ttsChain;
    } catch {
      // Streaming failed — fall back to a simple greeting
      const fallback = `Good ${timePeriod} sir. Your dashboard is ready.`;
      setConversation(prev => prev.map(e =>
        e.id === briefEntryId ? { ...e, text: fallback } : e
      ));
      setOrbState('speaking');
      await speak(fallback);
    }

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
    addActionItems(reply);
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

    // Pitch session: intercept all queries when a session is active
    const pitchState = pitchSessionRef.current;
    if (pitchState.active) {
      const lower = userText.trim().toLowerCase();
      if (['stop', 'end session', 'stop review', 'end review'].some(w => lower.includes(w))) {
        abortPitchSession();
        return;
      }
      if (pitchState.status === 'awaiting_verdict') {
        addEntry('user', userText);
        convHistoryRef.current.push({ role: 'user', content: userText });
        if (['develop', 'green light', 'greenlight', 'yes'].some(w => lower.includes(w))) {
          handlePitchVerdict('develop');
        } else if (['vault', 'save it'].some(w => lower.includes(w))) {
          handlePitchVerdict('vault');
        } else if (['kill', 'pass', 'no', 'next'].some(w => lower === w || lower.startsWith(w + ' '))) {
          handlePitchVerdict('kill');
        } else if (['repeat', 'say that again'].some(w => lower.includes(w))) {
          pitchCurrent();
        } else if (lower.includes('more detail')) {
          speakPitchDetail();
        } else {
          const reminder = 'Say develop, vault, or kill to decide this pitch, sir.';
          addEntry('jarvis', reminder);
          setOrbState('speaking');
          speak(reminder).then(() => setOrbState('idle'));
        }
        return;
      }
      // During pitching/executing/fetching — block all other queries
      return;
    }

    // Pitch trigger phrase detection
    {
      const normalized = userText.trim().toLowerCase();
      if (PITCH_TRIGGERS.some(t => normalized.includes(t))) {
        addEntry('user', userText);
        convHistoryRef.current.push({ role: 'user', content: userText });
        startPitchReview(dashboardData?.lemaPitches ?? []);
        return;
      }
    }

    isProcessingRef.current = true;

    addEntry('user', userText);
    convHistoryRef.current.push({ role: 'user', content: userText });

    setOrbState('thinking');
    stopSpeaking();

    // Intercept "save session" — write conversation to Obsidian instead of sending to Claude
    if (userText.trim().toLowerCase() === 'save session') {
      try {
        if (isDemoMode) {
          const msg = 'Demo mode — session not saved, sir.';
          addEntry('jarvis', msg);
          setOrbState('speaking');
          await speak(msg);
        } else {
          const saveRes = await fetch('/api/save-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: convHistoryRef.current.slice(-20) }),
          });
          if (saveRes.ok) {
            const data = await saveRes.json() as { date?: string; time?: string };
            const msg = `Session memory saved to Obsidian for ${data.date ?? 'today'} at ${data.time ?? 'now'}, sir.`;
            addEntry('jarvis', msg);
            setOrbState('speaking');
            await speak(msg);
          } else {
            const msg = 'Unable to save session — check Obsidian connectivity, sir.';
            addEntry('jarvis', msg);
            setOrbState('speaking');
            await speak(msg);
          }
        }
      } catch {
        const msg = 'Session save failed unexpectedly, sir.';
        addEntry('jarvis', msg);
        setOrbState('speaking');
        await speak(msg);
      } finally {
        isProcessingRef.current = false;
        setOrbState('idle');
      }
      return;
    }

    const baseContext = dashboardData
      ? buildJarvisContext(dashboardData, COMPANY_ID, obsidianNotes)
      : 'Dashboard data unavailable — operating in limited mode.';

    const emailContext = emails.length > 0
      ? `\nGMAIL — LAST 21 DAYS (${emails.length} messages, ${emails.filter((e: { unread: boolean }) => e.unread).length} unread):\n` +
        emails.map((e: { unread: boolean; priority: string; inInbox?: boolean; from: string; subject: string; time: string; preview: string }) =>
          `- [${e.unread ? 'UNREAD' : 'READ'}${e.priority === 'high' ? ' HIGH-PRI' : ''}${e.inInbox === false ? ' ARCHIVED' : ''}] From: ${e.from} | Subject: ${e.subject} | ${e.time} | ${e.preview.slice(0, 80)}`
        ).join('\n')
      : '\nGMAIL: No messages loaded.';

    const calendarContext = calendarEvents.length > 0
      ? `\nCALENDAR — TODAY (${calendarEvents.length} events, ${calendarEvents.filter(e => !e.past).length} upcoming):\n` +
        calendarEvents.map(e => `- [${e.past ? 'PAST' : 'UPCOMING'}] ${e.title} at ${e.time}${e.duration ? ` (${e.duration})` : ''}${e.attendees ? ` — ${e.attendees} attendees` : ''}`).join('\n')
      : '\nCALENDAR: No events today.';

    // Per-query: search 6 months of email + Obsidian in parallel, auto-triggered on every query
    const [relevantEmails, relevantNotes] = await Promise.all([
      searchEmails(userText),
      searchObsidian(userText),
    ]);

    const relevantEmailContext = relevantEmails.length > 0
      ? `\nRELEVANT EMAIL HISTORY — last 6 months matching "${userText}" (${relevantEmails.length} results):\n` +
        relevantEmails.map(e =>
          `- [${e.unread ? 'UNREAD' : 'READ'}${e.priority === 'high' ? ' HIGH-PRI' : ''}] From: ${e.from} | Subject: ${e.subject} | ${e.time} | ${e.preview.slice(0, 120)}`
        ).join('\n')
      : '\nRELEVANT EMAIL HISTORY: No matching emails in the last 6 months.';

    const relevantObsidianContext = relevantNotes.length > 0
      ? `\nRELEVANT OBSIDIAN NOTES matching "${userText}" (${relevantNotes.length} results):\n` +
        relevantNotes.map(n =>
          `- "${n.title}" [${n.path}]${n.tags.length ? ` #${n.tags.join(' #')}` : ''}\n  ${n.preview}`
        ).join('\n')
      : '';

    const context = baseContext + emailContext + calendarContext + relevantEmailContext + relevantObsidianContext;

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
          if (sentence.includes('[CTX_CARD]') || sentence.includes('[/CTX_CARD]')) return; // skip card block
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
            const { card, cleanText } = parseContextCard(fullText);
            if (card) setContextCard(card);
            setConversation(prev => prev.map(e =>
              e.id === jarvisEntryId ? { ...e, text: cleanText } : e
            ));
            convHistoryRef.current.push({ role: 'assistant', content: cleanText });
            addActionItems(cleanText);
          }
        },
        memoryContext || undefined
      );

      if (!commandDetected) await ttsChain;
    } catch (err) {
      // Streaming failed — fall back to the non-streaming path
      console.warn('Streaming failed, falling back to non-streaming:', err);
      setConversation(prev => prev.filter(e => e.id !== jarvisEntryId));

      try {
        const response = await askJarvis(userText, context, convHistoryRef.current.slice(-8), memoryContext || undefined);
        const command = parseCommandResponse(response);
        if (command) {
          setPendingCommand(command);
          pendingCommandRef.current = command;
          addEntry('jarvis', command.confirmation);
          setOrbState('speaking');
          await speak(command.confirmation + ' Say execute to proceed, or cancel.');
          setOrbState('idle');
        } else {
          const { card: fbCard, cleanText: fbClean } = parseContextCard(response);
          if (fbCard) setContextCard(fbCard);
          convHistoryRef.current.push({ role: 'assistant', content: fbClean });
          addEntry('jarvis', fbClean);
          addActionItems(fbClean);
          setOrbState('speaking');
          await speak(fbClean);
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
  }, [dashboardData, obsidianNotes, memoryContext, handleExecute, handleCancel, pitchSessionRef, startPitchReview, handlePitchVerdict, abortPitchSession, pitchCurrent, speakPitchDetail]);

  const { isListening, isSupported, startListening } = useSpeechRecognition(processQuery);

  // Keep startListeningRef in sync so usePitchReview can call startListening after TTS
  startListeningRef.current = startListening;

  // Duck music when JARVIS TTS is speaking
  useEffect(() => {
    if (orbState === 'speaking') {
      duckForTts();
    } else {
      unduckFromTts();
    }
  }, [orbState]);

  // Duck music hard when mic is actively listening (prevents speech recognition picking up music)
  useEffect(() => {
    if (isListening) {
      duckForMic();
    } else {
      unduckFromMic();
    }
  }, [isListening]);

  const { isListening: wakeListening } = useWakeWord(
    () => {
      unlockAudio();
      stopSpeaking(); // interrupt any active speech
      if (!isProcessingRef.current) {
        setOrbState('listening');
        startListening();
      }
    },
    // Gate on micReady: don't start wake word until mic permission is resolved so
    // SpeechRecognition never shows the permission dialog while music is playing.
    micReady && !micMuted && (orbState === 'idle' || orbState === 'speaking') && !isProcessingRef.current,
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
          {musicPlaying && (
            <button
              onClick={() => { stopMorningTheme(); setMusicPlaying(false); }}
              title="Stop morning theme"
              className="flex items-center gap-1 px-2 py-1 tracking-widest transition-all hover:opacity-80"
              style={{ border: '1px solid rgba(0,212,255,0.35)', color: '#00d4ff', background: 'transparent', fontSize: '0.5rem', borderRadius: 2 }}
            >
              ♫ STOP MUSIC
            </button>
          )}
          {/* Voice parameter tuner */}
          <div ref={voiceTunerRef}>
            <button
              ref={voiceButtonRef}
              onClick={() => {
                if (!voiceTunerOpen && voiceButtonRef.current) {
                  const rect = voiceButtonRef.current.getBoundingClientRect();
                  setVoiceTunerPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                }
                setVoiceTunerOpen(v => !v);
              }}
              title="Tune JARVIS voice"
              className="flex items-center gap-1 px-2 py-1 tracking-widest transition-all hover:opacity-80"
              style={{
                border: `1px solid rgba(0,212,255,${voiceTunerOpen ? '0.6' : '0.2'})`,
                color: voiceTunerOpen ? '#00d4ff' : '#2a6080',
                background: voiceTunerOpen ? 'rgba(0,212,255,0.08)' : 'transparent',
                fontSize: '0.5rem',
                borderRadius: 2,
              }}
            >
              ◈ VOICE
            </button>
            {voiceTunerOpen && (
              <div
                className="p-3 font-mono"
                style={{
                  position: 'fixed',
                  top: voiceTunerPos.top,
                  right: voiceTunerPos.right,
                  zIndex: 9999,
                  background: '#020f1e',
                  border: '1px solid rgba(0,212,255,0.3)',
                  borderRadius: 4,
                  minWidth: 210,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
                }}
              >
                <div className="tracking-widest mb-3" style={{ color: '#00d4ff', fontSize: '0.48rem', letterSpacing: '0.2em' }}>
                  VOICE · ELEVENLABS
                </div>
                {([
                  { key: 'speed' as const, label: 'SPEED', min: 0.5, max: 2.0 },
                  { key: 'stability' as const, label: 'STABILITY', min: 0, max: 1 },
                  { key: 'similarity_boost' as const, label: 'SIMILARITY', min: 0, max: 1 },
                  { key: 'style' as const, label: 'STYLE', min: 0, max: 1 },
                ] as const).map(({ key, label, min, max }) => (
                  <div key={key} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="tracking-widest" style={{ color: '#2a6080', fontSize: '0.42rem' }}>{label}</span>
                      <span style={{ color: '#00d4ff', fontSize: '0.42rem' }}>{voiceParams[key].toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={0.05}
                      value={voiceParams[key]}
                      onChange={e => updateVoiceParam(key, parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: '#00d4ff', cursor: 'pointer' }}
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const defaults = { speed: 1.2, stability: 0.75, similarity_boost: 0.85, style: 0.3 };
                    setVoiceParamsState(defaults);
                    setVoiceParams(defaults);
                  }}
                  className="w-full tracking-widest py-1 mt-1 transition-opacity hover:opacity-80"
                  style={{ color: '#1a4060', border: '1px solid rgba(0,212,255,0.1)', fontSize: '0.42rem', borderRadius: 2, background: 'transparent' }}
                >
                  RESET DEFAULTS
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => handleTextSubmit('save session')}
            title="Save session memory to Obsidian"
            className="hidden sm:flex items-center gap-1 px-2 py-1 tracking-widest transition-all hover:opacity-80"
            style={{ border: '1px solid rgba(0,212,255,0.2)', color: '#2a6080', background: 'transparent', fontSize: '0.5rem', borderRadius: 2 }}
          >
            ⬡ SAVE SESSION
          </button>
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

      {/* Main layout — 3-col flex row on desktop, stacked on mobile */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 p-3 md:p-4 overflow-y-auto md:overflow-hidden">

        {/* Center: Orb — first on mobile (order-first), visual col 2 on desktop (md:order-2) */}
        <div className="md:flex-[40] min-h-0 flex flex-col order-first md:order-2">
          <div className="flex-1 panel-border corner-decoration rounded flex flex-col relative overflow-hidden">
            {/* Grid + radial glow background */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(ellipse at 50% 42%, rgba(0,212,255,0.07) 0%, transparent 55%), linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)',
                backgroundSize: 'auto, 32px 32px, 32px 32px',
              }}
            />

            {/* Wake indicator */}
            {wakeListening && (
              <motion.div
                className="absolute top-3 right-3 flex items-center gap-1.5 z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#00d4ff' }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs tracking-widest" style={{ color: '#2a5f80', fontSize: '0.6rem' }}>WAKE</span>
              </motion.div>
            )}

            {/* Orb — centered, constrained to ~70% of its previous height */}
            <div className="flex-1 min-h-0 flex items-center justify-center relative" style={{ maxHeight: '38vh' }}>
              <VoiceOrb state={currentOrbState} onClick={handleOrbClick} orbSize={200} />
            </div>

            {/* Below orb: label + large clock + state + stats */}
            <div className="flex flex-col items-center pb-4 px-4 flex-shrink-0">
              <div className="text-xs tracking-widest mb-1" style={{ color: '#1a4060', fontSize: '0.6rem', letterSpacing: '0.3em' }}>
                J · A · R · V · I · S
              </div>
              <LargeOrbClock />
              <div className="flex items-center gap-2 mt-1 mb-4">
                <motion.span
                  key={currentOrbState}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs tracking-widest"
                  style={{
                    color: currentOrbState === 'idle' ? '#2a5f80'
                      : currentOrbState === 'listening' ? '#00d4ff'
                      : currentOrbState === 'thinking' ? '#fbbf24'
                      : '#34d399',
                    fontSize: '0.6rem',
                  }}
                >
                  {currentOrbState.toUpperCase()}
                </motion.span>
                <span style={{ color: '#1a3040', fontSize: '0.6rem' }}>·</span>
                <span className="text-xs tracking-widest" style={{ color: '#1a4060', fontSize: '0.6rem' }}>
                  {!isSupported ? 'USE TEXT INPUT' : 'CLICK JARVIS'}
                </span>
              </div>

              {/* Stats row */}
              {dashboardData && (
                <div className="flex gap-2 w-full max-w-xs">
                  {[
                    { label: 'AGENTS', value: `${dashboardData.agents.length}` },
                    { label: 'REVIEW', value: `${dashboardData.inReviewIssues.length}` },
                    { label: 'BLOCKED', value: `${dashboardData.blockedIssues.length}` },
                    { label: 'QUEUE', value: `${dashboardData.waitingOnMeIssues.length}` },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      className="flex-1 text-center py-1 px-1"
                      style={{ border: '1px dashed rgba(0,212,255,0.15)', borderRadius: 2 }}
                    >
                      <div className="text-xs font-bold" style={{ color: '#00d4ff', fontSize: '0.75rem' }}>{stat.value}</div>
                      <div className="text-xs tracking-widest" style={{ color: '#1a3040', fontSize: '0.45rem' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lemon Virtual Pitches — voice session + idle count, consolidated in center */}
            {dashboardData && (
              <div className="flex-shrink-0" style={{ borderTop: '1px solid rgba(0,212,255,0.08)', height: 220 }}>
                <PitchReviewPanel
                  session={pitchSession}
                  pendingPitches={(dashboardData.lemaPitches ?? []).filter(p => p.status === 'in_review')}
                  onStartReview={() => startPitchReview(dashboardData.lemaPitches ?? [])}
                  onVerdict={handlePitchVerdict}
                  onAbort={abortPitchSession}
                />
              </div>
            )}

            {/* Text input embedded at bottom */}
            <div className="flex-shrink-0" style={{ borderTop: '1px solid rgba(0,212,255,0.06)' }}>
              <TextInput onSubmit={handleTextSubmit} disabled={isProcessingRef.current} />
            </div>
          </div>
        </div>

        {/* Left: Intel tabs — second on mobile (order-2), visual col 1 on desktop (md:order-1) */}
        <div className="md:flex-[35] min-h-0 desktop-agents-panel flex flex-col gap-0 order-2 md:order-1">
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
                actionItems={actionItems}
                onDismissItem={handleDismissItem}
                lastUpdated={lastUpdated}
                onAction={handleTextSubmit}
                contextCard={contextCard}
                obsidianNotes={obsidianNotes.slice(0, 8)}
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
              <EmailPanel onAction={handleTextSubmit} />
            ) : leftTab === 'calendar' ? (
              <CalendarPanel onAction={handleTextSubmit} />
            ) : (
              <ObsidianPanel onAction={handleTextSubmit} />
            )}
          </div>
        </div>

        {/* Right: Tabbed issues + Pitches + Agenda — visual col 3 on desktop */}
        <div className="md:flex-[25] min-h-0 flex flex-col gap-3 desktop-side-panel order-3">
          <div className="flex-[3] min-h-[200px]">
            {isLoading ? (
              <LoadingSkeleton label="PENDING REVIEW" />
            ) : (
              <RightIssuesTabs
                reviewIssues={dashboardData?.inReviewIssues ?? []}
                blockedIssues={dashboardData?.blockedIssues ?? []}
                waitingIssues={dashboardData?.waitingOnMeIssues ?? []}
                onRefresh={refreshDashboard}
                newIssueIds={newIssueIds}
              />
            )}
          </div>
          <div className="flex-1 min-h-[120px]">
            {isLoading ? (
              <LoadingSkeleton label="TODAY'S AGENDA" />
            ) : (
              <AgendaPanel issues={dashboardData?.myInbox ?? []} onRefresh={refreshDashboard} />
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
        {import.meta.env.VITE_BUILD_TIME && (
          <span className="ml-3 opacity-40">
            · BUILD {new Date(import.meta.env.VITE_BUILD_TIME).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).toUpperCase()}
          </span>
        )}
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

function LargeOrbClock() {
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')} : ${String(d.getMinutes()).padStart(2,'0')} : ${String(d.getSeconds()).padStart(2,'0')}`;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2,'0')} : ${String(d.getMinutes()).padStart(2,'0')} : ${String(d.getSeconds()).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="font-mono tracking-widest select-none"
      style={{ color: '#1e5a7a', fontSize: '2rem', letterSpacing: '0.1em', fontWeight: 300 }}
      animate={{ opacity: [0.6, 1, 0.6] }}
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

const CARD_COLORS: Record<ContextCardKind, { accent: string; bg: string; border: string }> = {
  movie:   { accent: '#f97316', bg: 'rgba(249,115,22,0.06)',  border: 'rgba(249,115,22,0.2)'  },
  weather: { accent: '#0ea5e9', bg: 'rgba(14,165,233,0.06)', border: 'rgba(14,165,233,0.2)'  },
  project: { accent: '#00d4ff', bg: 'rgba(0,212,255,0.06)',  border: 'rgba(0,212,255,0.2)'   },
  person:  { accent: '#a855f7', bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.2)'  },
  issue:   { accent: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.2)'  },
  generic: { accent: '#64748b', bg: 'rgba(100,116,139,0.04)',border: 'rgba(100,116,139,0.15)' },
};

const CARD_ICONS: Record<ContextCardKind, string> = {
  movie: '◆', weather: '◈', project: '⬡', person: '◉', issue: '▶', generic: '◈',
};

const CARD_LABELS: Record<ContextCardKind, string> = {
  movie: 'MOVIE', weather: 'WEATHER', project: 'PROJECT', person: 'PERSON', issue: 'ISSUE', generic: 'CONTEXT',
};

function ContextCardDisplay({ card }: { card: ContextCard }) {
  const colors = CARD_COLORS[card.kind];
  const metaEntries = card.meta ? Object.entries(card.meta) : [];
  return (
    <motion.div
      key={card.id}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        padding: '10px 12px',
        marginBottom: 10,
        flexShrink: 0,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ color: colors.accent, fontSize: '0.7rem' }}>{CARD_ICONS[card.kind]}</span>
        <span className="tracking-widest" style={{ color: colors.accent, fontSize: '0.48rem', opacity: 0.8 }}>
          {CARD_LABELS[card.kind]}
        </span>
        {card.subtitle && (
          <>
            <span style={{ color: colors.accent, fontSize: '0.48rem', opacity: 0.3 }}>·</span>
            <span className="tracking-widest truncate" style={{ color: colors.accent, fontSize: '0.48rem', opacity: 0.6 }}>
              {card.subtitle.toUpperCase()}
            </span>
          </>
        )}
      </div>
      <div className="font-mono" style={{ color: colors.accent, fontSize: '0.88rem', fontWeight: 500, lineHeight: 1.3, marginBottom: metaEntries.length ? 0 : 0 }}>
        {card.title}
      </div>
      {metaEntries.length > 0 && (
        <>
          <div style={{ height: 1, background: colors.border, margin: '7px 0' }} />
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {metaEntries.map(([k, v]) => (
              <div key={k}>
                <div className="tracking-widest" style={{ color: colors.accent, opacity: 0.4, fontSize: '0.42rem' }}>{k.toUpperCase()}</div>
                <div style={{ color: colors.accent, opacity: 0.85, fontSize: '0.72rem', lineHeight: 1.3 }}>{v}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

function ObsidianNoteItem({ note, onAction }: {
  note: ObsidianNote;
  onAction: (text: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded p-2"
      style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.14)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-mono leading-snug flex-1" style={{ color: '#c084fc', fontSize: '0.68rem', lineHeight: 1.35 }}>
          {note.title}
        </div>
        <button
          onClick={() => onAction(`Tell me about "${note.title}" from my Obsidian notes`)}
          className="flex-shrink-0 tracking-widest transition-opacity opacity-55 hover:opacity-100"
          style={{ color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', fontSize: '7px', padding: '2px 6px', borderRadius: 2 }}
        >
          ASK
        </button>
      </div>
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {note.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{ color: '#7c3aed', background: 'rgba(124,58,237,0.12)', fontSize: '7px', padding: '1px 4px', borderRadius: 1 }}>
              #{tag}
            </span>
          ))}
        </div>
      )}
      {note.preview && (
        <div style={{ color: '#5b21b6', fontSize: '0.68rem', lineHeight: 1.4 }}>
          {note.preview.slice(0, 90)}{note.preview.length > 90 ? '…' : ''}
        </div>
      )}
    </motion.div>
  );
}

interface BriefingPanelProps {
  actionItems: ActionItem[];
  onDismissItem: (id: string) => void;
  lastUpdated: Date;
  onAction: (text: string) => void;
  contextCard: ContextCard | null;
  obsidianNotes?: ObsidianNote[];
}

function BriefingPanel({ actionItems, onDismissItem, lastUpdated, onAction, contextCard, obsidianNotes = [] }: BriefingPanelProps) {
  const hour = new Date().getHours();
  const periodLabel = hour < 12 ? 'MORNING CHECK-IN' : hour < 17 ? 'MID-DAY CHECK-IN' : 'END-OF-DAY BRIEF';

  const CHIPS = [
    "What's blocking us?",
    "Today's reviews",
    "Agent status",
    "What's next?",
  ];
  return (
    <div className="panel-border corner-decoration rounded h-full flex flex-col" style={{ padding: '12px 14px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <motion.span
          className="text-jarvis tracking-widest"
          style={{ fontSize: '0.6rem' }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          {periodLabel}
        </motion.span>
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest px-1.5 py-0.5" style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', fontSize: '0.5rem' }}>
            ACTION ITEMS{actionItems.length > 0 ? ` · ${actionItems.length}` : ''}
          </span>
          <span className="text-xs tracking-widest" style={{ color: '#1a3040', fontSize: '0.5rem' }}>
            {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
      <div className="glow-line flex-shrink-0" />

      {/* Live visual context card — updates as Jarvis speaks */}
      <div className="flex-shrink-0 pt-2">
        <AnimatePresence mode="wait">
          {contextCard && <ContextCardDisplay key={contextCard.id} card={contextCard} />}
        </AnimatePresence>
      </div>

      {/* Scrollable feed: JARVIS action items + Obsidian brain notes */}
      <div className="flex-1 overflow-y-auto min-h-0 py-2 space-y-3">
        {/* JARVIS-extracted action items */}
        {actionItems.length > 0 ? (
          <div className="space-y-1.5">
            {actionItems.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.3) }}
                className="flex items-start gap-2"
                style={{
                  background: 'rgba(0,212,255,0.03)',
                  border: '1px solid rgba(0,212,255,0.1)',
                  borderRadius: 3,
                  padding: '7px 9px',
                }}
              >
                <span style={{ color: '#1a5a80', fontSize: '0.55rem', marginTop: 3, flexShrink: 0 }}>▶</span>
                <div className="flex-1 min-w-0">
                  <div style={{ color: '#a8d8f0', fontSize: '0.78rem', lineHeight: 1.55 }}>{item.text}</div>
                  <div className="tracking-widest" style={{ color: '#0d2030', fontSize: '0.48rem', marginTop: 2 }}>
                    {item.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button
                  onClick={() => onDismissItem(item.id)}
                  title="Dismiss"
                  className="flex-shrink-0 transition-colors"
                  style={{ color: '#1a4060', fontSize: '0.7rem', lineHeight: 1, padding: '1px 3px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#00d4ff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#1a4060')}
                >
                  ✓
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-3">
            <motion.div
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="tracking-widest"
              style={{ color: '#2a5f80', fontSize: '0.65rem' }}
            >
              AWAITING BRIEFING
            </motion.div>
            <div className="leading-relaxed" style={{ color: '#1a3040', fontSize: '0.75rem', lineHeight: '1.7' }}>
              Click the orb or type a question.
            </div>
          </div>
        )}

        {/* BRAIN · RECENT — Obsidian vault notes */}
        {obsidianNotes.length > 0 && (
          <div>
            <div
              className="tracking-widest mb-2 flex items-center gap-2"
              style={{ color: '#3b1f6e', fontSize: '0.48rem', borderTop: '1px solid rgba(168,85,247,0.08)', paddingTop: 8 }}
            >
              <span style={{ color: '#a855f7', opacity: 0.6 }}>◈</span>
              BRAIN · RECENT
            </div>
            <div className="space-y-1.5">
              {obsidianNotes.map(note => (
                <ObsidianNoteItem key={note.path} note={note} onAction={onAction} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick-action chips */}
      <div className="flex-shrink-0 pt-2" style={{ borderTop: '1px solid rgba(0,212,255,0.06)' }}>
        <div className="tracking-widest mb-1.5" style={{ color: '#1a3040', fontSize: '0.5rem' }}>QUICK ACTIONS</div>
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => onAction(chip)}
              className="px-2 py-1 tracking-widest transition-all hover:opacity-80"
              style={{ border: '1px solid rgba(0,212,255,0.2)', color: '#2a6080', background: 'transparent', fontSize: '0.55rem', borderRadius: 2 }}
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
