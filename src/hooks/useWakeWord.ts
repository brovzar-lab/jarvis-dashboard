import { useState, useEffect, useRef } from 'react';

interface WakeRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface WakeRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: WakeRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

const WAKE_WORDS = ['hey jarvis', 'jarvis'];

function checkIsSupported(): boolean {
  const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!hasSR) return false;
  // Disable on iOS Safari — continuous recognition is blocked there
  return !/iPad|iPhone|iPod/.test(navigator.userAgent) || !/Safari/.test(navigator.userAgent);
}

export function useWakeWord(
  onWakeWordDetected: () => void,
  enabled: boolean,
): { isListening: boolean; isSupported: boolean } {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(checkIsSupported);

  const recognitionRef = useRef<WakeRecognitionInstance | null>(null);
  const enabledRef = useRef(enabled);
  const onDetectedRef = useRef(onWakeWordDetected);
  const stoppedByDetectionRef = useRef(false);

  onDetectedRef.current = onWakeWordDetected;
  enabledRef.current = enabled;

  useEffect(() => {
    if (!isSupported) return;

    const Ctor = (window.SpeechRecognition || window.webkitSpeechRecognition) as new () => WakeRecognitionInstance;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: WakeRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript.toLowerCase())
        .join(' ');

      if (WAKE_WORDS.some(w => transcript.includes(w))) {
        stoppedByDetectionRef.current = true;
        recognition.stop();
        setIsListening(false);
        onDetectedRef.current();
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (stoppedByDetectionRef.current) {
        stoppedByDetectionRef.current = false;
        return;
      }
      // Auto-restart if still enabled
      if (enabledRef.current) {
        try {
          recognition.start();
          setIsListening(true);
        } catch {
          // Browser busy — ignore
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognitionRef.current = null;
      try { recognition.stop(); } catch { /* ignore */ }
    };
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported || !recognitionRef.current) return;

    if (enabled && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        // Already running — fine
      }
    } else if (!enabled && isListening) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      setIsListening(false);
    }
  }, [enabled, isSupported, isListening]);

  return { isListening, isSupported };
}
