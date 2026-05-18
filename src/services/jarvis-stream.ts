import { JARVIS_SYSTEM_PROMPT } from './jarvis-ai';

export async function askJarvisStreaming(
  userMessage: string,
  dashboardContext: string,
  conversationHistory: Array<{ role: string; content: string }>,
  onSentence: (sentence: string) => void,
  onDone: (fullText: string, usage: { input_tokens: number; output_tokens: number }) => void
): Promise<void> {
  const messages = [
    ...conversationHistory.slice(-6),
    { role: 'user', content: `${dashboardContext}\n\nUser query: ${userMessage}` },
  ];

  const res = await fetch('/api/claude/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: JARVIS_SYSTEM_PROMPT,
      messages,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Stream request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let sseBuffer = '';
  let sentenceBuffer = '';
  let fullText = '';
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });

    const events = sseBuffer.split('\n\n');
    sseBuffer = events.pop() ?? '';

    for (const event of events) {
      let eventType = '';
      let dataLine = '';

      for (const line of event.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataLine = line.slice(6);
      }

      if (!dataLine || dataLine === '[DONE]') continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(dataLine) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (parsed.type === 'message_start') {
        const msg = parsed.message as Record<string, unknown> | undefined;
        const usage = msg?.usage as Record<string, number> | undefined;
        if (usage) inputTokens = usage.input_tokens ?? 0;
      }

      if (
        eventType === 'content_block_delta' &&
        (parsed as { delta?: { type?: string; text?: string } }).delta?.type === 'text_delta'
      ) {
        const text = (parsed as { delta: { text: string } }).delta.text ?? '';
        fullText += text;
        sentenceBuffer += text;
        flushSentences(sentenceBuffer, onSentence, remainder => { sentenceBuffer = remainder; });
      }

      if (eventType === 'message_delta') {
        const usage = (parsed as { usage?: { output_tokens?: number } }).usage;
        if (usage) outputTokens = usage.output_tokens ?? 0;
      }
    }
  }

  if (sentenceBuffer.trim()) {
    onSentence(sentenceBuffer.trim());
  }

  onDone(fullText.trim(), { input_tokens: inputTokens, output_tokens: outputTokens });
}

function flushSentences(
  buffer: string,
  onSentence: (s: string) => void,
  setBuffer: (remainder: string) => void
): void {
  let remaining = buffer;
  let match: RegExpExecArray | null;
  while ((match = /[.?!;:]\s+/.exec(remaining)) !== null) {
    const sentence = remaining.slice(0, match.index + 1).trim();
    remaining = remaining.slice(match.index + match[0].length);
    if (sentence) onSentence(sentence);
  }
  setBuffer(remaining);
}
