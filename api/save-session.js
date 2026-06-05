// POST /api/save-session
// Accepts { messages: [{role, content}] } — the current conversation history.
// Uses Claude to extract key facts/decisions, then appends to Jarvis/Session Memory/YYYY-MM-DD.md.
//
// Format written:
//   ## Session — HH:MM
//   - key fact or decision
//   - key fact or decision

import { isObsidianConfigured, obsidianGet, obsidianPut } from './_lib/obsidian-client.js';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.VITE_CLAUDE_API_KEY;
const GITHUB_TOKEN = process.env.OBSIDIAN_GITHUB_TOKEN;
const GITHUB_REPO = process.env.OBSIDIAN_GITHUB_REPO; // format: "owner/repo"

// GitHub fallback: write vault file via GitHub Contents API when Obsidian REST is unreachable
async function writeToGitHub(filePath, content) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return false;
  const encodedPath = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodedPath}`;
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
  let sha;
  try {
    const getRes = await fetch(apiUrl, { headers });
    if (getRes.ok) { const d = await getRes.json(); sha = d.sha; }
  } catch {}
  try {
    const body = { message: `JARVIS: session memory ${filePath}`, content: Buffer.from(content).toString('base64') };
    if (sha) body.sha = sha;
    const putRes = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
    return putRes.ok || putRes.status === 201;
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  if (!isObsidianConfigured()) {
    return res.status(503).json({ error: 'Obsidian not configured — set OBSIDIAN_API_URL and OBSIDIAN_API_KEY' });
  }

  if (!CLAUDE_API_KEY) {
    return res.status(503).json({ error: 'Claude API key not configured' });
  }

  // Build a readable transcript for Claude to summarise
  const transcript = messages
    .filter(m => m.role && m.content)
    .map(m => `${m.role === 'user' ? 'User' : 'Jarvis'}: ${String(m.content).trim()}`)
    .join('\n');

  if (!transcript) {
    return res.status(400).json({ error: 'No readable messages to save' });
  }

  let bullets;
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
        max_tokens: 400,
        system: 'Extract 3 to 7 key facts, decisions, or action items from this conversation as a markdown bullet list. Each bullet must be one clear, standalone sentence. Output ONLY the bullet lines starting with "- ", no other text, no headings.',
        messages: [{ role: 'user', content: transcript }],
      }),
    });

    if (!claudeRes.ok) {
      const body = await claudeRes.text();
      console.warn('[save-session] Claude extraction failed:', claudeRes.status, body.slice(0, 200));
      return res.status(502).json({ error: 'Failed to extract session facts from Claude' });
    }

    const claudeData = await claudeRes.json();
    bullets = (claudeData.content?.[0]?.text ?? '').trim();
  } catch (err) {
    console.warn('[save-session] Claude request error:', err?.message ?? err);
    return res.status(502).json({ error: 'Claude request failed' });
  }

  if (!bullets) {
    return res.status(502).json({ error: 'Claude returned empty extraction' });
  }

  // Build the dated entry
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const entry = `\n## Session — ${time}\n${bullets}\n`;

  // Read existing daily file (if any) and append
  const filePath = `Jarvis/Session Memory/${date}.md`;
  const existing = await obsidianGet(filePath);
  const newContent = existing
    ? existing.trimEnd() + entry
    : `# Session Memory — ${date}\n${entry}`;

  let written = await obsidianPut(filePath, newContent);
  let via = 'obsidian';
  if (!written) {
    // Obsidian REST API unreachable (e.g. local URL not exposed) — fall back to GitHub
    written = await writeToGitHub(filePath, newContent);
    via = 'github';
  }
  if (!written) {
    return res.status(502).json({ error: 'Failed to write session memory — Obsidian REST and GitHub both failed' });
  }

  return res.json({ ok: true, date, time, via });
}
