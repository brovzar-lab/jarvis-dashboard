declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || '';
// Antoni voice — closest to a Jarvis-style male voice
const ELEVENLABS_VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'ErXwobaYiN019PkySvjV';

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

  if (ELEVENLABS_API_KEY && ELEVENLABS_API_KEY !== 'REPLACE_WITH_VALUE') {
    await speakElevenLabs(text);
  } else {
    await speakBrowser(text);
  }
}

async function speakElevenLabs(text: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.85,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );
  } catch {
    console.warn('ElevenLabs TTS network error, falling back to browser TTS');
    await speakBrowser(text);
    return;
  }

  if (!res.ok) {
    console.warn('ElevenLabs TTS failed, falling back to browser TTS');
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
    utterance.rate = 0.95;
    utterance.volume = 1;
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
