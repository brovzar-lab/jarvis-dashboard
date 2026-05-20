import { useState, useCallback, useRef } from 'react';
import { speak, stopSpeaking } from '../services/tts';
import { fetchPitchDocuments, executePitchVerdict, isDemoMode } from '../services/paperclip';
import type { Issue, OrbState } from '../types';

export type PitchStatus = 'idle' | 'fetching' | 'pitching' | 'awaiting_verdict' | 'executing' | 'summary';

export interface PitchSessionState {
  active: boolean;
  pitches: Issue[];
  currentIndex: number;
  stats: { developed: number; vaulted: number; killed: number };
  status: PitchStatus;
}

const IDLE_STATE: PitchSessionState = {
  active: false,
  pitches: [],
  currentIndex: 0,
  stats: { developed: 0, vaulted: 0, killed: 0 },
  status: 'idle',
};

interface Options {
  setOrbState: (s: OrbState) => void;
  onReadyForVerdict: () => void;
  addEntry: (role: 'user' | 'jarvis', text: string) => void;
}

export function usePitchReview({ setOrbState, onReadyForVerdict, addEntry }: Options) {
  const [session, setSession] = useState<PitchSessionState>(IDLE_STATE);
  const sessionRef = useRef<PitchSessionState>(IDLE_STATE);
  const docCacheRef = useRef<Map<string, string>>(new Map());
  const abortRef = useRef(false);

  const update = useCallback((patch: Partial<PitchSessionState>) => {
    setSession(prev => {
      const next = { ...prev, ...patch };
      sessionRef.current = next;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    sessionRef.current = IDLE_STATE;
    setSession(IDLE_STATE);
  }, []);

  const buildPitchText = useCallback(async (issue: Issue): Promise<string> => {
    const cached = docCacheRef.current.get(issue.id);
    if (cached) return cached;

    let synopsis = issue.description?.slice(0, 350) ?? '';
    let tone = '';
    let comps = '';

    if (!isDemoMode) {
      try {
        const docs = await fetchPitchDocuments(issue.id);
        for (const doc of docs) {
          const body = doc.body ?? '';
          if (!synopsis && body) synopsis = body.slice(0, 350);
          const toneMatch = /[Tt]one[:\s]+([^\n]+)/.exec(body);
          if (toneMatch && !tone) tone = toneMatch[1].trim().slice(0, 80);
          const compsMatch = /[Cc]omps?[:\s]+([^\n]+)/.exec(body);
          if (compsMatch && !comps) comps = compsMatch[1].trim().slice(0, 80);
        }
      } catch {
        // degrade gracefully
      }
    }

    const parts = [`OK Billy, next one. This one's called ${issue.title}. Here's the deal...`];
    if (synopsis) parts.push(synopsis);
    if (tone) parts.push(`Tone: ${tone}.`);
    if (comps) parts.push(`Comps: ${comps}.`);
    parts.push('Develop, vault, or kill?');

    const text = parts.join(' ');
    docCacheRef.current.set(issue.id, text);
    return text;
  }, []);

  // Forward ref so advanceToNext can call pitchCurrent without a stale closure
  const pitchCurrentRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const pitchCurrent = useCallback(async () => {
    const s = sessionRef.current;
    if (!s.active || s.currentIndex >= s.pitches.length) return;

    const issue = s.pitches[s.currentIndex];
    update({ status: 'pitching' });

    const text = await buildPitchText(issue);
    if (abortRef.current) return;

    setOrbState('speaking');
    await speak(text);
    if (abortRef.current) return;

    update({ status: 'awaiting_verdict' });
    setOrbState('idle');
    onReadyForVerdict();
  }, [update, buildPitchText, setOrbState, onReadyForVerdict]);

  pitchCurrentRef.current = pitchCurrent;

  const advanceToNext = useCallback(async () => {
    const s = sessionRef.current;
    const nextIndex = s.currentIndex + 1;

    if (nextIndex >= s.pitches.length) {
      const { developed, vaulted, killed } = s.stats;
      const total = developed + vaulted + killed;
      const summary = `OK Billy, we ran ${total} pitch${total === 1 ? '' : 'es'}. You greenlit ${developed} for development, vaulted ${vaulted}, killed ${killed}.`;
      update({ status: 'summary' });
      addEntry('jarvis', summary);
      setOrbState('speaking');
      await speak(summary);
      setOrbState('idle');
      reset();
    } else {
      update({ currentIndex: nextIndex });
      await pitchCurrentRef.current();
    }
  }, [update, reset, addEntry, setOrbState]);

  const handleVerdict = useCallback(async (verdict: 'develop' | 'vault' | 'kill') => {
    const s = sessionRef.current;
    if (!s.active || s.status !== 'awaiting_verdict') return;

    const issue = s.pitches[s.currentIndex];
    const newStats = { ...s.stats };
    if (verdict === 'develop') newStats.developed++;
    else if (verdict === 'vault') newStats.vaulted++;
    else newStats.killed++;

    update({ status: 'executing', stats: newStats });
    setOrbState('thinking');

    const labels = { develop: 'Greenlighting', vault: 'Vaulting', kill: 'Killing' };
    const confirmText = `${labels[verdict]} "${issue.title}", sir.`;
    addEntry('jarvis', confirmText);

    await Promise.all([
      speak(confirmText),
      isDemoMode ? Promise.resolve() : executePitchVerdict(issue.id, verdict).catch(console.warn),
    ]);

    if (abortRef.current) return;
    setOrbState('idle');
    await advanceToNext();
  }, [update, addEntry, setOrbState, advanceToNext]);

  const abortSession = useCallback(async () => {
    abortRef.current = true;
    stopSpeaking();
    reset();
    docCacheRef.current.clear();
    const msg = 'Pitch review session ended, sir.';
    addEntry('jarvis', msg);
    setOrbState('speaking');
    await speak(msg);
    setOrbState('idle');
  }, [reset, addEntry, setOrbState]);

  const speakMoreDetail = useCallback(async () => {
    const s = sessionRef.current;
    if (!s.active) return;
    const issue = s.pitches[s.currentIndex];
    const detail = issue.description
      ? issue.description.slice(0, 600)
      : 'No additional detail available.';

    update({ status: 'pitching' });
    setOrbState('speaking');
    await speak(`Full detail for ${issue.title}: ${detail} Develop, vault, or kill?`);
    if (abortRef.current) return;
    update({ status: 'awaiting_verdict' });
    setOrbState('idle');
    onReadyForVerdict();
  }, [update, setOrbState, onReadyForVerdict]);

  const startPitchReview = useCallback(async (allPitches: Issue[]) => {
    const pending = allPitches.filter(p => p.status === 'in_review');

    if (pending.length === 0) {
      const msg = 'No pitches awaiting review in the Development Gate, sir.';
      addEntry('jarvis', msg);
      setOrbState('speaking');
      await speak(msg);
      setOrbState('idle');
      return;
    }

    abortRef.current = false;
    docCacheRef.current.clear();

    const newState: PitchSessionState = {
      active: true,
      pitches: pending,
      currentIndex: 0,
      stats: { developed: 0, vaulted: 0, killed: 0 },
      status: 'fetching',
    };
    sessionRef.current = newState;
    setSession(newState);

    const intro = `Pitch review session starting. ${pending.length} project${pending.length !== 1 ? 's' : ''} in the Development Gate. Let's run through them.`;
    addEntry('jarvis', intro);
    setOrbState('speaking');
    await speak(intro);
    if (abortRef.current) return;
    setOrbState('idle');

    await pitchCurrentRef.current();
  }, [addEntry, setOrbState]);

  return {
    session,
    sessionRef,
    startPitchReview,
    handleVerdict,
    abortSession,
    pitchCurrent,
    speakMoreDetail,
  };
}
