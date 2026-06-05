// POST /api/memory/extract
// Uses Claude Haiku to extract structured memories from a conversation turn.
// Returns { memories: ExtractedMemory[] }

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.VITE_CLAUDE_API_KEY;

const EXTRACTION_PROMPT = `You are a memory extraction system for JARVIS, an executive AI assistant for Billy Rovzar (CEO, Lemon Studios Mexico City).

Your job: Extract structured, actionable knowledge from the provided text that JARVIS should remember for future conversations.

For EACH memory, classify its SCOPE:

**GLOBAL** — Universal knowledge that applies across all future conversations:
  - Billy's preferences, habits, communication style
  - Company rules, rates, patterns (e.g. "bridge loan is secured against Apple cashflows")
  - Facts about key people and relationships
  - Recurring patterns JARVIS observes (e.g. "Billy always asks about blockers first")

**SESSION** — Conversation-specific facts that may become stale:
  - Status of a specific task or deal mentioned today
  - An email Billy needs to reply to
  - A specific decision made in this conversation

For EACH memory, classify its TYPE:
  - "fact" — Objective, verifiable statement
  - "experience" — Numeric data, rates, costs, metrics
  - "preference" — Billy's stated preference for how things should be done
  - "observation" — Pattern or insight synthesized from behavior

Return a JSON array. Each element:
{
  "scope": "global" | "session",
  "type": "fact" | "experience" | "preference" | "observation",
  "content": "One clear, concise sentence under 150 chars",
  "entities": ["named people, companies, projects"],
  "categories": ["email", "calendar", "deal", "production", "agent", "preference"],
  "keywords": ["lowercase", "search", "terms"]
}

Rules:
- Extract ONLY actionable knowledge. Skip greetings, filler, meta-conversation.
- Be specific: "Magnetic Labs bridge loan requires DocuSign by Friday" > "there's a deal pending"
- One memory per fact. Don't combine.
- Prefer "preference" type for anything that reveals how Billy likes to work.
- If nothing worth remembering, return []
- Return ONLY the JSON array, no markdown fencing, no explanation.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!CLAUDE_API_KEY) {
    return res.status(503).json({ error: 'Claude API key not configured' });
  }

  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return res.json({ memories: [] });
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
        max_tokens: 600,
        system: EXTRACTION_PROMPT,
        messages: [{ role: 'user', content: `Extract memories from this JARVIS response:\n\n${text.slice(0, 2000)}` }],
      }),
    });

    if (!claudeRes.ok) {
      console.warn('[memory/extract] Claude failed:', claudeRes.status);
      return res.json({ memories: [] });
    }

    const claudeData = await claudeRes.json();
    const raw = (claudeData.content?.[0]?.text ?? '').trim();

    let memories = [];
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        memories = parsed
          .filter(m => m && typeof m.content === 'string' && m.content.length >= 5)
          .map(m => ({
            scope: m.scope === 'global' ? 'global' : 'session',
            type: ['fact', 'experience', 'preference', 'observation'].includes(m.type) ? m.type : 'fact',
            content: String(m.content).slice(0, 200),
            entities: Array.isArray(m.entities) ? m.entities.slice(0, 8) : [],
            categories: Array.isArray(m.categories) ? m.categories.slice(0, 6) : [],
            keywords: Array.isArray(m.keywords) ? m.keywords.slice(0, 10) : [],
          }));
      }
    } catch {
      // malformed JSON — return empty
    }

    return res.json({ memories });
  } catch (err) {
    console.warn('[memory/extract] Error:', err?.message ?? err);
    return res.json({ memories: [] });
  }
}
