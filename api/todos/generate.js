// POST /api/todos/generate
// Uses Claude Haiku to extract actionable to-do recommendations from emails, calendar, and Obsidian notes.
// Returns { todos: Array<{ text, source, priority }> }

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.VITE_CLAUDE_API_KEY;

const EXTRACTION_PROMPT = `You are a to-do recommendation engine for JARVIS, an executive AI assistant for Billy Rovzar (CEO, Lemon Studios Mexico City).

Analyze the provided emails, calendar events, and Obsidian brain notes. Extract ONLY genuinely actionable to-do items that Billy should add to his personal task list today or this week.

Rules:
- Be specific and concrete: "Reply to Sofia re: contract clause" > "Check emails"
- Only surface items that require Billy's personal attention or decision — skip agent/team tasks
- Prioritize: high = today or deadline imminent, medium = this week, low = someday/backlog
- Max 8 items total — quality over quantity
- Skip obvious meetings (calendar already shows those) unless there's a specific prep action needed
- Skip items that are clearly already resolved or completed
- Return ONLY the JSON array, no markdown fencing, no explanation

Return a JSON array where each element is:
{
  "text": "Concise actionable task, under 100 chars",
  "source": "email" | "calendar" | "obsidian",
  "priority": "high" | "medium" | "low"
}

If nothing actionable is found, return [].`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!CLAUDE_API_KEY) {
    return res.status(503).json({ error: 'Claude API key not configured' });
  }

  const { emails = [], calendarEvents = [], obsidianNotes = [] } = req.body ?? {};

  const emailContext = emails.length > 0
    ? `EMAILS (${emails.length} recent):\n${emails.slice(0, 15).map(e =>
        `- [${e.unread ? 'UNREAD' : 'READ'}${e.priority === 'high' ? ' URGENT' : ''}] From: ${e.from} | ${e.subject} | ${(e.preview ?? '').slice(0, 100)}`
      ).join('\n')}`
    : 'EMAILS: none loaded';

  const calendarContext = calendarEvents.length > 0
    ? `CALENDAR TODAY:\n${calendarEvents.map(e =>
        `- [${e.past ? 'PAST' : 'UPCOMING'}] ${e.title} at ${e.time}${e.duration ? ` (${e.duration})` : ''}${e.attendees ? ` — ${e.attendees} attendees` : ''}`
      ).join('\n')}`
    : 'CALENDAR: no events';

  const notesContext = obsidianNotes.length > 0
    ? `OBSIDIAN BRAIN NOTES:\n${obsidianNotes.slice(0, 12).map(n =>
        `- [${n.title}]: ${(n.preview ?? '').slice(0, 180)}`
      ).join('\n')}`
    : 'OBSIDIAN: no notes loaded';

  const context = `${emailContext}\n\n${calendarContext}\n\n${notesContext}`;

  if (emails.length === 0 && calendarEvents.length === 0 && obsidianNotes.length === 0) {
    return res.json({ todos: [] });
  }

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: EXTRACTION_PROMPT,
        messages: [{
          role: 'user',
          content: `Extract actionable to-dos from this context:\n\n${context.slice(0, 4000)}`,
        }],
      }),
    });

    if (!claudeRes.ok) {
      console.warn('[todos/generate] Claude failed:', claudeRes.status);
      return res.json({ todos: [] });
    }

    const claudeData = await claudeRes.json();
    const raw = (claudeData.content?.[0]?.text ?? '').trim();

    let todos = [];
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        todos = parsed
          .filter(t => t && typeof t.text === 'string' && t.text.length >= 5)
          .slice(0, 8)
          .map(t => ({
            text: String(t.text).slice(0, 150),
            source: ['email', 'calendar', 'obsidian'].includes(t.source) ? t.source : 'email',
            priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
          }));
      }
    } catch {
      // malformed JSON — return empty
    }

    return res.json({ todos });
  } catch (err) {
    console.warn('[todos/generate] Error:', err?.message ?? err);
    return res.json({ todos: [] });
  }
}
