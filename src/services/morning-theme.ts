// Morning theme music — plays once on load (after first user interaction unlocks audio).
// Set VITE_MORNING_THEME_URL to any hosted MP3 URL, or drop morning-theme.mp3 in /public.
const THEME_URL =
  (import.meta.env.VITE_MORNING_THEME_URL as string | undefined)?.trim() ||
  '/morning-theme.mp3';

const BASE_VOLUME = 0.25;

let themeAudio: HTMLAudioElement | null = null;
let started = false;
let stopped = false;

// Ducking state — tracked separately so calls can overlap without fighting each other
let ttsActive = false;
let micActive = false;
let fadeInterval: ReturnType<typeof setInterval> | null = null;

function getAudio(): HTMLAudioElement {
  if (!themeAudio) {
    themeAudio = new Audio(THEME_URL);
    themeAudio.volume = BASE_VOLUME;
    themeAudio.loop = false;
    themeAudio.onended = () => { started = false; };
  }
  return themeAudio;
}

function computeTargetVolume(): number {
  if (micActive) return BASE_VOLUME * 0.15;   // ~3.75% — speech recognition window
  if (ttsActive) return BASE_VOLUME * 0.5;    // 12.5% — JARVIS speaking
  return BASE_VOLUME;                          // 25% — ambient idle
}

function fadeTo(vol: number, durationMs = 300): void {
  if (!themeAudio) return;
  if (fadeInterval) { clearInterval(fadeInterval); fadeInterval = null; }
  if (themeAudio.paused) {
    themeAudio.volume = Math.max(0, Math.min(1, vol));
    return;
  }
  const steps = Math.max(1, Math.round(durationMs / 20));
  const startVol = themeAudio.volume;
  const delta = (vol - startVol) / steps;
  let step = 0;
  fadeInterval = setInterval(() => {
    step++;
    if (themeAudio) {
      themeAudio.volume = Math.max(0, Math.min(1, startVol + delta * step));
    }
    if (step >= steps) {
      clearInterval(fadeInterval!);
      fadeInterval = null;
      if (themeAudio) themeAudio.volume = Math.max(0, Math.min(1, vol));
    }
  }, durationMs / steps);
}

// Try to start immediately — works after browser grants autoplay permission.
export function tryStartMorningTheme(): void {
  if (started || stopped) return;
  const audio = getAudio();
  audio.play().then(() => { started = true; }).catch(() => { /* blocked — will retry after unlock */ });
}

// Call this once from the first user-gesture handler.
export function startMorningThemeOnUnlock(): void {
  if (started || stopped) return;
  const audio = getAudio();
  audio.play().then(() => { started = true; }).catch(() => {});
}

export function stopMorningTheme(): void {
  stopped = true;
  started = false;
  if (themeAudio) {
    themeAudio.pause();
    themeAudio.currentTime = 0;
  }
}

export function isMorningThemePlaying(): boolean {
  return started && themeAudio !== null && !themeAudio.paused;
}

export function resetMorningTheme(): void {
  stopped = false;
  started = false;
  themeAudio = null;
  ttsActive = false;
  micActive = false;
  if (fadeInterval) { clearInterval(fadeInterval); fadeInterval = null; }
}

// Duck to 50% when JARVIS TTS is speaking
export function duckForTts(): void {
  ttsActive = true;
  fadeTo(computeTargetVolume(), 200);
}

export function unduckFromTts(): void {
  ttsActive = false;
  fadeTo(computeTargetVolume(), 400);
}

// Duck hard when mic is actively listening (prevent music from being picked up as speech)
export function duckForMic(): void {
  micActive = true;
  fadeTo(computeTargetVolume(), 150);
}

export function unduckFromMic(): void {
  micActive = false;
  fadeTo(computeTargetVolume(), 300);
}
