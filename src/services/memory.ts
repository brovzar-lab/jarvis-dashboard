import type {
  Memory,
  ExtractedMemory,
  QueryContext,
  ScoredMemory,
} from '../types/memory';
import {
  DEFAULT_CONFIDENCE,
  ARCHIVE_THRESHOLD,
  MAX_RECALL_MEMORIES,
  DECAY_RATE_PER_DAY,
  DEDUP_THRESHOLD,
  MIN_DAYS_BEFORE_DECAY,
} from '../types/memory';

const STORAGE_KEY = 'jarvis_brain';

// ── Persistence (localStorage)

export function loadMemories(): Memory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMemories(memories: Memory[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  } catch { /* storage full — degrade gracefully */ }
}

// ── Deduplication (Jaccard token overlap)

function tokenise(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const t of a) { if (b.has(t)) intersection++; }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function findDuplicate(candidate: ExtractedMemory, existing: Memory[]): Memory | null {
  const cTokens = tokenise(candidate.content);
  for (const m of existing) {
    if (m.scope !== candidate.scope || m.archived) continue;
    if (jaccard(cTokens, tokenise(m.content)) >= DEDUP_THRESHOLD) return m;
  }
  return null;
}

// ── Scoring (8 channels)

function scoreMemory(memory: Memory, context: QueryContext): number {
  const { contentText = '', categories = [], entities = [], keywords = [] } = context;

  const memKeywords = new Set(memory.keywords.map(k => k.toLowerCase()));
  const memCategories = new Set(memory.categories.map(c => c.toLowerCase()));
  const memEntities = new Set(memory.entities.map(e => e.toLowerCase()));
  const ctxKeywords = new Set(keywords.map(k => k.toLowerCase()));
  const ctxCategories = new Set(categories.map(c => c.toLowerCase()));
  const ctxEntities = new Set(entities.map(e => e.toLowerCase()));

  // 1. Keyword overlap
  let kwScore = 0;
  for (const k of ctxKeywords) { if (memKeywords.has(k)) kwScore += 0.15; }
  kwScore = Math.min(kwScore, 0.45);

  // 2. Category match
  let catScore = 0;
  for (const c of ctxCategories) { if (memCategories.has(c)) catScore += 0.12; }
  catScore = Math.min(catScore, 0.36);

  // 3. Entity match
  let entScore = 0;
  for (const e of ctxEntities) { if (memEntities.has(e)) entScore += 0.15; }
  entScore = Math.min(entScore, 0.45);

  // 4. Content keyword match — tokenise the user's query text against memory
  let contentScore = 0;
  if (contentText.trim()) {
    const contentTokens = tokenise(contentText);
    for (const t of contentTokens) {
      if (memKeywords.has(t) || memEntities.has(t)) contentScore += 0.05;
    }
    contentScore = Math.min(contentScore, 0.30);
  }

  // 5. Confidence weight
  const confScore = memory.confidence * 0.15;

  // 6. Temporal recency (bonus for recently used, decays over 90 days)
  let recencyScore = 0;
  if (memory.lastRecalledAt) {
    const daysAgo = (Date.now() - new Date(memory.lastRecalledAt).getTime()) / 86_400_000;
    recencyScore = Math.max(0, 0.05 * (1 - daysAgo / 90));
  }

  // 7. Preference type bonus — preferences are almost always relevant
  const prefBonus = memory.type === 'preference' ? 0.1 : 0;

  return kwScore + catScore + entScore + contentScore + confScore + recencyScore + prefBonus;
}

// ── Recall (synchronous, reads from in-memory array)

export function recall(
  memories: Memory[],
  context: QueryContext,
  maxResults: number = MAX_RECALL_MEMORIES,
): ScoredMemory[] {
  return memories
    .filter(m => !m.archived && m.confidence > ARCHIVE_THRESHOLD)
    .map(memory => ({ memory, score: scoreMemory(memory, context) }))
    .filter(s => s.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

// ── Format for prompt injection

export function formatForPrompt(scored: ScoredMemory[]): string {
  if (scored.length === 0) return '';

  const globals = scored.filter(s => s.memory.scope === 'global');
  const sessions = scored.filter(s => s.memory.scope === 'session');

  const TYPE_ICONS: Record<string, string> = {
    preference: '★',
    fact: '◆',
    experience: '💰',
    observation: '◎',
  };

  const lines: string[] = ['---', '## JARVIS Brain — Learned Knowledge'];

  if (globals.length > 0) {
    lines.push('\n### What I know about you:');
    for (const { memory } of globals) {
      lines.push(`${TYPE_ICONS[memory.type] ?? '◆'} ${memory.content}`);
    }
  }

  if (sessions.length > 0) {
    lines.push('\n### From recent context:');
    for (const { memory } of sessions) {
      lines.push(`• ${memory.content}`);
    }
  }

  lines.push('\nApply this knowledge. Do not repeat these facts unless directly asked.');
  return lines.join('\n');
}

// ── Retain (fire-and-forget — calls /api/memory/extract, deduplicates, persists)

export function retain(text: string): void {
  if (!text || text.trim().length < 30) return;

  fetch('/api/memory/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
    .then(r => r.ok ? r.json() : null)
    .then((data: { memories?: ExtractedMemory[] } | null) => {
      if (!data?.memories?.length) return;

      const existing = loadMemories();
      const now = new Date().toISOString();
      const toAdd: Memory[] = [];

      for (const extracted of data.memories) {
        const duplicate = findDuplicate(extracted, existing);
        if (duplicate) {
          // Reinforce existing memory (diminishing returns)
          const boost = 0.05 * (1 / (1 + duplicate.timesConfirmed * 0.3));
          duplicate.confidence = Math.min(0.98, duplicate.confidence + boost);
          duplicate.timesConfirmed += 1;
          duplicate.updatedAt = now;
        } else {
          toAdd.push({
            id: `mem_${now}_${Math.random().toString(36).slice(2, 8)}`,
            scope: extracted.scope,
            type: extracted.type,
            content: extracted.content,
            source: 'agent_chat',
            entities: extracted.entities,
            categories: extracted.categories,
            keywords: extracted.keywords,
            confidence: DEFAULT_CONFIDENCE,
            timesRecalled: 0,
            timesConfirmed: 0,
            timesContradicted: 0,
            createdAt: now,
            updatedAt: now,
            archived: false,
          });
        }
      }

      saveMemories([...existing, ...toAdd]);
    })
    .catch(() => { /* silent fail — memory is non-critical */ });
}

// ── Retain from user correction (immediate, no LLM needed)

export function retainCorrection(correctionText: string): void {
  if (!correctionText.trim()) return;
  const now = new Date().toISOString();
  const existing = loadMemories();

  const memory: Memory = {
    id: `mem_${now}_${Math.random().toString(36).slice(2, 8)}`,
    scope: 'global',
    type: 'preference',
    content: correctionText.slice(0, 200),
    source: 'user_correction',
    entities: [],
    categories: ['preference', 'correction'],
    keywords: correctionText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2).slice(0, 10),
    confidence: 0.9,
    timesRecalled: 0,
    timesConfirmed: 1,
    timesContradicted: 0,
    createdAt: now,
    updatedAt: now,
    archived: false,
  };

  // Dedup against existing corrections
  const duplicate = findDuplicate({ ...memory, scope: 'global' } as ExtractedMemory, existing);
  if (duplicate) {
    duplicate.timesConfirmed += 1;
    duplicate.confidence = Math.min(0.98, duplicate.confidence + 0.05);
    duplicate.updatedAt = now;
    saveMemories(existing);
  } else {
    saveMemories([...existing, memory]);
  }
}

// ── Mark recalled (update timestamps + counts)

export function markRecalled(scored: ScoredMemory[]): void {
  if (scored.length === 0) return;
  const all = loadMemories();
  const recalledIds = new Set(scored.map(s => s.memory.id));
  const now = new Date().toISOString();
  let changed = false;
  for (const m of all) {
    if (recalledIds.has(m.id)) {
      m.timesRecalled += 1;
      m.lastRecalledAt = now;
      changed = true;
    }
  }
  if (changed) saveMemories(all);
}

// ── Reflect (confidence decay + archival) — run on app open

export function reflect(): void {
  const all = loadMemories();
  const now = Date.now();
  let changed = false;

  for (const m of all) {
    if (m.archived) continue;

    const lastUsed = m.lastRecalledAt ?? m.createdAt;
    const daysUnused = (now - new Date(lastUsed).getTime()) / 86_400_000;

    if (daysUnused < MIN_DAYS_BEFORE_DECAY) continue;

    const baseConfidence = (m.timesConfirmed + 1) / (m.timesConfirmed + m.timesContradicted + 2);
    const decayed = baseConfidence * Math.exp(-DECAY_RATE_PER_DAY * daysUnused);

    if (decayed < ARCHIVE_THRESHOLD) {
      m.archived = true;
      m.updatedAt = new Date().toISOString();
      changed = true;
    } else if (Math.abs(decayed - m.confidence) > 0.02) {
      m.confidence = decayed;
      m.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) saveMemories(all);
}

// ── Build QueryContext from a user query string

export function buildQueryContext(query: string): QueryContext {
  const tokens = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);

  const EMAIL_WORDS = ['email', 'mail', 'inbox', 'message', 'reply', 'respond', 'from', 'subject'];
  const CALENDAR_WORDS = ['meeting', 'calendar', 'event', 'schedule', 'appointment', 'call', 'today'];
  const DEAL_WORDS = ['deal', 'loan', 'bridge', 'magnetic', 'trust', 'fund', 'equity', 'contract', 'signing'];
  const PROD_WORDS = ['production', 'shoot', 'edit', 'vfx', 'delivery', 'netflix', 'apple', 'series'];
  const AGENT_WORDS = ['agent', 'task', 'blocked', 'issue', 'ticket', 'review', 'pending'];

  const categories: string[] = [];
  if (tokens.some(t => EMAIL_WORDS.includes(t))) categories.push('email');
  if (tokens.some(t => CALENDAR_WORDS.includes(t))) categories.push('calendar');
  if (tokens.some(t => DEAL_WORDS.includes(t))) categories.push('deal');
  if (tokens.some(t => PROD_WORDS.includes(t))) categories.push('production');
  if (tokens.some(t => AGENT_WORDS.includes(t))) categories.push('agent');

  return {
    contentText: query,
    keywords: tokens.slice(0, 15),
    categories,
    entities: [],
  };
}
