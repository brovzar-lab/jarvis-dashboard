// Morning theme music — plays once on load (after first user interaction unlocks audio).
// Set VITE_MORNING_THEME_URL to any hosted MP3 URL, or drop morning-theme.mp3 in /public.
const THEME_URL =
  (import.meta.env.VITE_MORNING_THEME_URL as string | undefined)?.trim() ||
  '/morning-theme.mp3';

let themeAudio: HTMLAudioElement | null = null;
let started = false;
let stopped = false;

function getAudio(): HTMLAudioElement {
  if (!themeAudio) {
    themeAudio = new Audio(THEME_URL);
    themeAudio.volume = 0.25;
    themeAudio.loop = false;
    themeAudio.onended = () => { started = false; };
  }
  return themeAudio;
}

// Try to start immediately — works after browser grants autoplay permission.
// Falls back silently; call again from unlockAudio() path.
export function tryStartMorningTheme(): void {
  if (started || stopped) return;
  const audio = getAudio();
  audio.play().then(() => { started = true; }).catch(() => { /* blocked — will retry after unlock */ });
}

// Call this once from the first user-gesture handler (unlockAudio wrapper in App.tsx).
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

// Reset stopped flag when user wants to restart (e.g. page reload equivalent)
export function resetMorningTheme(): void {
  stopped = false;
  started = false;
  themeAudio = null;
}
