type Listener = (cost: number) => void;
const listeners = new Set<Listener>();
let sessionCost = 0;

const CLAUDE_INPUT_PER_TOKEN = 3 / 1_000_000;   // $3/M input tokens
const CLAUDE_OUTPUT_PER_TOKEN = 15 / 1_000_000;  // $15/M output tokens
const TTS_PER_CHAR = 22 / 1_000_000;              // $22/M chars (ElevenLabs Starter)

function notify() {
  listeners.forEach(l => l(sessionCost));
}

export function addClaudeUsage(inputTokens: number, outputTokens: number): void {
  sessionCost += inputTokens * CLAUDE_INPUT_PER_TOKEN + outputTokens * CLAUDE_OUTPUT_PER_TOKEN;
  notify();
}

export function addTtsChars(chars: number): void {
  sessionCost += chars * TTS_PER_CHAR;
  notify();
}

export function getSessionCost(): number {
  return sessionCost;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
