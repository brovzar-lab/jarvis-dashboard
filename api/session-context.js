// GET /api/session-context
// Fetches and bundles Jarvis memory context from Obsidian for injection into the system prompt.
// Server-side only — OBSIDIAN_API_KEY is a Vercel secret, never exposed to the client.
//
// Returns: { memoryContext: string }
//   memoryContext is a markdown string containing:
//     1. Lemon Context note (configurable via OBSIDIAN_LEMON_CONTEXT_PATH)
//     2. Jarvis/People.md (bootstrapped with defaults if missing)
//     3. Up to 5 most recent Jarvis/Session Memory/ entries (date DESC)
//
// Caches result in-process for 5 minutes to avoid re-fetching on every chat turn.

import { isObsidianConfigured, obsidianGet, obsidianList, obsidianPut, ensureMd } from './_lib/obsidian-client.js';

const LEMON_CONTEXT_PATH = ensureMd(process.env.OBSIDIAN_LEMON_CONTEXT_PATH || 'Lemon Context');

const PEOPLE_BOOTSTRAP = `# Jarvis People

- BR: Billy Rovzar (CEO, Lemaa)
- IT: [expand from Lemon Context]
- ES: [expand from Lemon Context]
`;

// In-process cache — survives across warm Lambda invocations within the same session.
let cachedContext = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Serve from cache if fresh enough
  if (cachedContext !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    return res.json({ memoryContext: cachedContext });
  }

  if (!isObsidianConfigured()) {
    return res.json({ memoryContext: '' });
  }

  try {
    const parts = [];

    // 1. Lemon Context note
    const lemonContent = await obsidianGet(LEMON_CONTEXT_PATH);
    if (lemonContent) {
      parts.push(`=== Lemon Context (Obsidian) ===\n${lemonContent.trim()}`);
    }

    // 2. Jarvis/People.md — bootstrap with defaults if it doesn't exist yet
    let peopleContent = await obsidianGet('Jarvis/People.md');
    if (!peopleContent) {
      await obsidianPut('Jarvis/People.md', PEOPLE_BOOTSTRAP);
      peopleContent = PEOPLE_BOOTSTRAP;
    }
    parts.push(`=== People (Jarvis/People.md) ===\n${peopleContent.trim()}`);

    // 3. Five most recent session memory files (YYYY-MM-DD.md sorted DESC)
    const allFiles = await obsidianList('Jarvis/Session Memory');
    const sessionFiles = allFiles
      .filter(f => /\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse()
      .slice(0, 5);

    if (sessionFiles.length > 0) {
      const sessionParts = await Promise.all(
        sessionFiles.map(async (filePath) => {
          const name = filePath.replace(/^.*\//, '');
          const content = await obsidianGet(filePath);
          return content ? `--- ${name} ---\n${content.trim()}` : null;
        })
      );
      const validSessions = sessionParts.filter(Boolean);
      if (validSessions.length > 0) {
        parts.push(`=== Recent Session Memory ===\n${validSessions.join('\n\n')}`);
      }
    }

    const memoryContext = parts.join('\n\n');
    cachedContext = memoryContext;
    cachedAt = Date.now();

    return res.json({ memoryContext });
  } catch (err) {
    console.warn('[session-context] Obsidian fetch failed:', err?.message ?? err);
    // Return stale cache or empty — never crash Jarvis
    return res.json({ memoryContext: cachedContext ?? '' });
  }
}
