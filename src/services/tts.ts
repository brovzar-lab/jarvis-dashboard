const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || '';
// Antoni voice — closest to a Jarvis-style male voice
const ELEVENLABS_VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'ErXwobaYiN019PkySvjV';

let currentAudio: HTMLAudioElement | null = null;

export async function speak(text: string): Promise<void> {
  stopSpeaking();

  if (ELEVENLABS_API_KEY && ELEVENLABS_API_KEY !== 'REPLACE_WITH_VALUE') {
    await speakElevenLabs(text);
  } else {
    await speakBrowser(text);
  }
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}

async function speakElevenLabs(text: string): Promise<void> {
  const res = await fetch(
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

  if (!res.ok) {
    console.warn('ElevenLabs TTS failed, falling back to browser TTS');
    await speakBrowser(text);
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  audio.play();

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

  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.85;
    utterance.rate = 0.95;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google UK English Male') ||
      v.name.includes('Daniel') ||
      v.name.includes('Alex') ||
      (v.lang === 'en-GB' && v.name.toLowerCase().includes('male'))
    );
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
