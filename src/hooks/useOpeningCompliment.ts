import { useEffect, useRef, useState, useCallback } from 'react';
import { stopSpeaking } from '../services/tts';

// sessionStorage: persists through tab refreshes but cleared on tab close — fires once per true session
const SESSION_KEY = 'jarvis_welcomed';

export function useOpeningCompliment(
  micReady: boolean,
  onCompliment: () => Promise<void>,
): { isComplimenting: boolean; skipCompliment: () => void } {
  const calledRef = useRef(false);
  const onComplimentRef = useRef(onCompliment);
  onComplimentRef.current = onCompliment;
  const [isComplimenting, setIsComplimenting] = useState(false);

  const skipCompliment = useCallback(() => {
    stopSpeaking();
    setIsComplimenting(false);
  }, []);

  useEffect(() => {
    if (!micReady) return;
    if (calledRef.current) return;
    if (sessionStorage.getItem(SESSION_KEY) === 'true') return;

    calledRef.current = true;
    sessionStorage.setItem(SESSION_KEY, 'true');

    setIsComplimenting(true);
    onComplimentRef.current().finally(() => setIsComplimenting(false));
  }, [micReady]);

  return { isComplimenting, skipCompliment };
}
