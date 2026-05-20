import { addTtsChars } from './cost-tracker';
import { startMorningThemeOnUnlock, unlockMorningThemeAudio } from './morning-theme';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export interface TtsVoiceParams {
  speed: number;
  stability: number;
  similarity_boost: number;
  style: number;
}

const DEFAULT_VOICE_PARAMS: TtsVoiceParams = {
  speed: 1.2,
  stability: 0.75,
  similarity_boost: 0.85,
  style: 0.3,
};

const VOICE_PARAMS_KEY = 'jarvis_voice_params';

function loadVoiceParams(): TtsVoiceParams {
  try {
    const saved = localStorage.getItem(VOICE_PARAMS_KEY);
    if (saved) return { ...DEFAULT_VOICE_PARAMS, ...(JSON.parse(saved) as Partial<TtsVoiceParams>) };
  } catch {}
  return { ...DEFAULT_VOICE_PARAMS };
}

let voiceParams: TtsVoiceParams = loadVoiceParams();

export function setVoiceParams(params: Partial<TtsVoiceParams>): void {
  voiceParams = { ...voiceParams, ...params };
  try { localStorage.setItem(VOICE_PARAMS_KEY, JSON.stringify(voiceParams)); } catch {}
}

export function getVoiceParams(): TtsVoiceParams {
  return { ...voiceParams };
}

let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentAudio: HTMLAudioElement | null = null;

// Call from any user gesture to unlock audio on iOS Safari.
// iOS blocks audio playback that isn't initiated within a user gesture context.
// Resuming AudioContext during a gesture unlocks it for subsequent async playback.
export function unlockAudio(): void {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioContext) {
    try {
      audioContext = new AC();
    } catch {
      return;
    }
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  unlockMorningThemeAudio();
  startMorningThemeOnUnlock();
}

export function stopSpeaking(): void {
  if (currentSource) {
    try { currentSource.stop(); } catch { /* already stopped */ }
    currentSource = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}

export async function speak(text: string): Promise<void> {
  stopSpeaking();
  await speakElevenLabs(text);
}

async function speakElevenLabs(text: string): Promise<void> {
  addTtsChars(text.length);

  let res: Response;
  try {
    res = await fetch('/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceSettings: voiceParams }),
    });
  } catch {
    console.warn('TTS proxy network error, falling back to browser TTS');
    await speakBrowser(text);
    return;
  }

  if (res.status === 503) {
    // TTS not configured server-side — fall back to browser TTS gracefully
    await speakBrowser(text);
    return;
  }

  if (!res.ok) {
    console.warn('TTS proxy error:', res.status, ', falling back to browser TTS');
    await speakBrowser(text);
    return;
  }

  const arrayBuffer = await res.arrayBuffer();

  // Preferred path: use unlocked AudioContext (works on iOS when unlockAudio() was called in a user gesture)
  if (audioContext && audioContext.state !== 'closed') {
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      return new Promise<void>(resolve => {
        const source = audioContext!.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = voiceParams.speed;
        source.connect(audioContext!.destination);
        currentSource = source;
        source.onended = () => {
          currentSource = null;
          resolve();
        };
        source.start(0);
      });
    } catch (err) {
      console.warn('AudioContext playback failed, trying Audio element', err);
    }
  }

  // Fallback: HTMLAudioElement (may be blocked on iOS without prior user gesture)
  const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;

  try {
    await audio.play();
  } catch (err) {
    console.warn('Audio.play() blocked (iOS requires user gesture). Falling back to browser TTS.', err);
    URL.revokeObjectURL(url);
    currentAudio = null;
    await speakBrowser(text);
    return;
  }

  await new Promise<void>(resolve => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      resolve();
    };
  });
}

async function speakBrowser(text: string): Promise<void> {
  if (!window.speechSynthesis) return;

  const getVoices = (): Promise<SpeechSynthesisVoice[]> =>
    new Promise(resolve => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) { resolve(voices); return; }
      const handler = () => {
        resolve(window.speechSynthesis.getVoices());
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
      };
      window.speechSynthesis.addEventListener('voiceschanged', handler);
      setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
    });

  const voices = await getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Google UK English Male') ||
    v.name.includes('Daniel') ||
    v.name.includes('Alex') ||
    (v.lang === 'en-GB' && v.name.toLowerCase().includes('male'))
  );

  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.85;
    utterance.rate = voiceParams.speed * 0.95;
    utterance.volume = 1;
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
