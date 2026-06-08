// Morning theme music — plays once on load (after first user interaction unlocks audio).
// Set VITE_MORNING_THEME_URL to any hosted MP3 URL, or drop morning-theme.mp3 in /public.
const THEME_URL =
  (import.meta.env.VITE_MORNING_THEME_URL as string | undefined)?.trim() ||
  '/morning-theme.mp3';

let BASE_VOLUME = (() => {
  try {
    const saved = localStorage.getItem('jarvis_music_volume');
    if (saved !== null) {
      const v = parseFloat(saved);
      if (!isNaN(v)) return Math.max(0, Math.min(1, v));
    }
  } catch {}
  return 0.42;
})();

let themeAudio: HTMLAudioElement | null = null;
let started = false;
let stopped = false;

// Web Audio API graph — the only way to control volume on iOS Safari.
// HTMLAudioElement.volume is read-only on iOS; GainNode.gain works everywhere.
declare global { interface Window { webkitAudioContext: typeof AudioContext; } }
let themeAudioCtx: AudioContext | null = null;
let themeGainNode: GainNode | null = null;
let themeSourceConnected = false;

// Ducking state — tracked separately so calls can overlap without fighting each other
let ttsActive = false;
let micActive = false;
let fadeInterval: ReturnType<typeof setInterval> | null = null;
// When true, all duck/unduck calls are suppressed so fadeOutAndStop() can run uninterrupted
let fadingOut = false;

// Called by tts.ts unlockAudio() inside a user gesture — required for iOS AudioContext.
export function unlockMorningThemeAudio(): void {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!themeAudioCtx) {
    try {
      themeAudioCtx = new AC();
      themeGainNode = themeAudioCtx.createGain();
      themeGainNode.gain.value = BASE_VOLUME;
      themeGainNode.connect(themeAudioCtx.destination);
    } catch { return; }
  }
  if (themeAudioCtx.state === 'suspended') {
    themeAudioCtx.resume().catch(() => {});
  }
  // Connect the audio element to the gain graph if it already exists
  connectToGainGraph();
}

function connectToGainGraph(): void {
  if (themeSourceConnected || !themeAudio || !themeAudioCtx || !themeGainNode) return;
  try {
    const source = themeAudioCtx.createMediaElementSource(themeAudio);
    source.connect(themeGainNode);
    themeSourceConnected = true;
    // With a connected GainNode, the element's own .volume no longer matters —
    // set it to 1 so gain is the single source of truth.
    themeAudio.volume = 1;
  } catch { /* already connected or not supported */ }
}

function getAudio(): HTMLAudioElement {
  if (!themeAudio) {
    themeAudio = new Audio(THEME_URL);
    themeAudio.volume = themeGainNode ? 1 : BASE_VOLUME;
    themeAudio.loop = false;
    themeAudio.onended = () => { started = false; };
    // Connect immediately if AudioContext was already unlocked
    connectToGainGraph();
  }
  return themeAudio;
}

function computeTargetVolume(): number {
  if (micActive) return BASE_VOLUME * 0.15;  // ~1.5% — mic window
  if (ttsActive) return BASE_VOLUME * 0.5;   // 12.5% — JARVIS speaking (drops to background)
  return BASE_VOLUME;                         // 10%  — ambient idle
}

function fadeTo(vol: number, durationMs = 300): void {
  if (fadingOut) return; // don't interrupt an active fade-out
  if (fadeInterval) { clearInterval(fadeInterval); fadeInterval = null; }

  // Prefer GainNode — works on iOS Safari (HTMLAudioElement.volume is ignored there)
  if (themeGainNode && themeAudioCtx && themeAudioCtx.state !== 'closed') {
    const startGain = themeGainNode.gain.value;
    const steps = Math.max(1, Math.round(durationMs / 20));
    const delta = (vol - startGain) / steps;
    let step = 0;
    fadeInterval = setInterval(() => {
      step++;
      if (themeGainNode) {
        themeGainNode.gain.value = Math.max(0, Math.min(1, startGain + delta * step));
      }
      if (step >= steps) {
        clearInterval(fadeInterval!);
        fadeInterval = null;
        if (themeGainNode) themeGainNode.gain.value = Math.max(0, Math.min(1, vol));
      }
    }, durationMs / steps);
    return;
  }

  // Fallback: HTMLAudioElement.volume (desktop when AudioContext not yet set up)
  if (!themeAudio) return;
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
  fadingOut = false;
  themeAudio = null;
  themeSourceConnected = false;
  ttsActive = false;
  micActive = false;
  if (fadeInterval) { clearInterval(fadeInterval); fadeInterval = null; }
}

// Fade to silence then stop — used after briefing ends or when user skips.
// Suppresses all duck/unduck calls for the duration so nothing fights the fade.
export function fadeOutAndStop(durationMs = 2500): void {
  if (fadingOut) return;
  fadingOut = true;
  if (fadeInterval) { clearInterval(fadeInterval); fadeInterval = null; }

  // GainNode path (iOS + desktop)
  if (themeGainNode && themeAudioCtx && themeAudioCtx.state !== 'closed') {
    const startGain = themeGainNode.gain.value;
    if (startGain <= 0) { stopMorningTheme(); fadingOut = false; return; }
    const steps = Math.max(1, Math.round(durationMs / 20));
    const delta = startGain / steps;
    let step = 0;
    fadeInterval = setInterval(() => {
      step++;
      if (themeGainNode) themeGainNode.gain.value = Math.max(0, startGain - delta * step);
      if (step >= steps) {
        clearInterval(fadeInterval!); fadeInterval = null;
        stopMorningTheme(); fadingOut = false;
      }
    }, durationMs / steps);
    return;
  }

  // HTMLAudioElement fallback
  if (!themeAudio || themeAudio.paused) { stopMorningTheme(); fadingOut = false; return; }
  const startVol = themeAudio.volume;
  if (startVol <= 0) { stopMorningTheme(); fadingOut = false; return; }
  const steps = Math.max(1, Math.round(durationMs / 20));
  const delta = startVol / steps;
  let step = 0;
  fadeInterval = setInterval(() => {
    step++;
    if (themeAudio) themeAudio.volume = Math.max(0, startVol - delta * step);
    if (step >= steps) {
      clearInterval(fadeInterval!); fadeInterval = null;
      stopMorningTheme(); fadingOut = false;
    }
  }, durationMs / steps);
}

export function duckForTts(): void {
  ttsActive = true;
  fadeTo(computeTargetVolume(), 1500);
}

export function unduckFromTts(): void {
  ttsActive = false;
  fadeTo(computeTargetVolume(), 400);
}

export function duckForMic(): void {
  micActive = true;
  fadeTo(computeTargetVolume(), 150);
}

export function unduckFromMic(): void {
  micActive = false;
  fadeTo(computeTargetVolume(), 300);
}

export function getBaseVolume(): number {
  return BASE_VOLUME;
}

export function setBaseVolume(vol: number): void {
  BASE_VOLUME = Math.max(0, Math.min(1, vol));
  try { localStorage.setItem('jarvis_music_volume', String(BASE_VOLUME)); } catch {}
  if (!fadingOut) fadeTo(computeTargetVolume(), 80);
}
