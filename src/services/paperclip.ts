import type { Agent, Issue, DashboardData } from '../types';
import type { ObsidianNote } from './integrations';

const BOARD_USER_ID = import.meta.env.VITE_BOARD_USER_ID || 'Ii0txDoen0NV1MLw20AKX79qv2cC6eR4';

const COMPANY_ID_ENV = import.meta.env.VITE_PAPERCLIP_COMPANY_ID || '';
const LEMA_COMPANY_ID = 'ff52ad91-250b-4d9d-a2ee-1d24b65ec3e8';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/paperclip?p=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Paperclip API returns direct arrays; some endpoints wrap in { agents/issues/items/data: [] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractArray<T>(raw: unknown, ...keys: string[]): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    for (const key of keys) {
      const val = (raw as Record<string, unknown>)[key];
      if (Array.isArray(val)) return val as T[];
    }
  }
  return [];
}

async function discoverCompanyIds(): Promise<string[]> {
  // Ask the server which companies it has API keys for
  try {
    const res = await fetch('/api/companies');
    if (res.ok) {
      const data = await res.json() as { companyIds?: string[] };
      if (Array.isArray(data.companyIds) && data.companyIds.length > 0) {
        return data.companyIds;
      }
    }
  } catch {
    // fall through to env var fallback
  }

  // Fall back to comma-separated env var
  return COMPANY_ID_ENV.split(',').map(s => s.trim()).filter(Boolean);
}

interface InboxItem { id: string; identifier: string; title: string; status: string; priority: string; updatedAt?: string }

export async function fetchDashboardData(): Promise<DashboardData> {
  const companyIds = await discoverCompanyIds();

  // Fetch agents and issues from all companies in parallel
  const [companyResults, inboxRes] = await Promise.allSettled([
    Promise.all(companyIds.map(async (cid) => {
      const [agentsRaw, inReviewRaw, activeRaw, blockedRaw, waitingRaw] = await Promise.all([
        apiGet<unknown>(`/api/companies/${cid}/agents`).catch(() => []),
        apiGet<unknown>(`/api/companies/${cid}/issues?status=in_review&limit=20`).catch(() => []),
        apiGet<unknown>(`/api/companies/${cid}/issues?status=in_progress&limit=50`).catch(() => []),
        apiGet<unknown>(`/api/companies/${cid}/issues?status=blocked&limit=30`).catch(() => []),
        apiGet<unknown>(`/api/companies/${cid}/issues?assigneeUserId=${BOARD_USER_ID}&status=in_review,todo&limit=20`).catch(() => []),
      ]);
      return {
        agents: extractArray<Agent>(agentsRaw, 'agents', 'data'),
        inReview: extractArray<Issue>(inReviewRaw, 'issues', 'data'),
        active: extractArray<Issue>(activeRaw, 'issues', 'data'),
        blocked: extractArray<Issue>(blockedRaw, 'issues', 'data'),
        waiting: extractArray<Issue>(waitingRaw, 'issues', 'data'),
      };
    })),
    apiGet<unknown>('/api/agents/me/inbox-lite'),
  ]);

  // Merge results across companies (deduplicate by id)
  const seenAgents = new Set<string>();
  const seenIssues = new Set<string>();
  const agents: Agent[] = [];
  const inReviewIssues: Issue[] = [];
  const activeIssues: Issue[] = [];
  const blockedIssues: Issue[] = [];
  const waitingOnMeIssues: Issue[] = [];

  if (companyResults.status === 'fulfilled') {
    for (const [idx, { agents: a, inReview: ir, active: ac, blocked: bl, waiting: wt }] of companyResults.value.entries()) {
      const cid = companyIds[idx];
      for (const agent of a) {
        if (!seenAgents.has(agent.id)) { seenAgents.add(agent.id); agents.push({ ...agent, companyId: cid }); }
      }
      for (const issue of ir) {
        if (!seenIssues.has(issue.id)) { seenIssues.add(issue.id); inReviewIssues.push({ ...issue, companyId: cid }); }
      }
      for (const issue of ac) {
        if (!seenIssues.has(issue.id)) { seenIssues.add(issue.id); activeIssues.push({ ...issue, companyId: cid }); }
      }
      for (const issue of bl) {
        if (!seenIssues.has(issue.id)) { seenIssues.add(issue.id); blockedIssues.push({ ...issue, companyId: cid }); }
      }
      for (const issue of wt) {
        if (!seenIssues.has(issue.id)) { seenIssues.add(issue.id); waitingOnMeIssues.push({ ...issue, companyId: cid }); }
      }
    }
  }

  const inboxRaw = inboxRes.status === 'fulfilled'
    ? extractArray<InboxItem>(inboxRes.value, 'items', 'issues', 'data')
    : [];

  const myInbox: Issue[] = inboxRaw.map((item) => ({
    id: item.id,
    identifier: item.identifier,
    title: item.title,
    status: item.status,
    priority: item.priority,
    updatedAt: item.updatedAt ?? new Date().toISOString(),
  }));

  // Fetch LEMA pitches (projects) from the Development Gate board.
  // Board URL: /LEMA/boards/development-gate  →  projects where board === 'development_gate'.
  // Pitches awaiting Billy's verdict have billyVerdict === null.
  // Each project has structured pitch fields: pitchSynopsis, genre, format, comps, etc.
  let lemaPitches: Issue[] = [];
  if (companyIds.includes(LEMA_COMPANY_ID)) {
    try {
      interface LemaProject {
        id: string;
        name: string;
        status: string;
        board?: string | null;
        billyVerdict?: string | null;
        queueStatus?: string | null;
        format?: string | null;
        genre?: string | null;
        pitchSynopsis?: string | null;
        comps?: string | null;
        description?: string | null;
      }
      const projectsRaw = await apiGet<unknown>(`/api/companies/${LEMA_COMPANY_ID}/projects?limit=200`).catch(() => null);
      if (projectsRaw) {
        const projects = extractArray<LemaProject>(projectsRaw, 'projects', 'data', 'items');
        lemaPitches = projects
          .filter(p =>
            p.board === 'development_gate' &&
            (p.billyVerdict == null || p.billyVerdict === '')
          )
          .map(p => {
            // Build a rich description JARVIS can read aloud.
            // Include format so film/TV detection works via keyword matching.
            const parts: string[] = [];
            if (p.format) parts.push(`Format: ${p.format}.`);
            if (p.genre) parts.push(`Genre: ${p.genre}.`);
            if (p.pitchSynopsis) parts.push(p.pitchSynopsis.slice(0, 500));
            if (p.comps) parts.push(`Comps: ${p.comps.slice(0, 150)}`);
            return {
              id: p.id,
              identifier: '',
              title: p.name,
              status: 'in_review' as const,
              priority: 'medium' as const,
              updatedAt: new Date().toISOString(),
              companyId: LEMA_COMPANY_ID,
              description: parts.length > 0 ? parts.join(' ') : (p.description ?? undefined),
            };
          });
      }
    } catch {
      // silently degrade — pitches panel will show empty state
    }
  }

  // Derive company labels from issue identifier prefixes (e.g. "APPU-617" → "APPU")
  const companyLabels: Record<string, string> = {};
  if (companyResults.status === 'fulfilled') {
    for (const [idx, { inReview: ir, active: ac }] of companyResults.value.entries()) {
      const cid = companyIds[idx];
      if (companyLabels[cid]) continue;
      for (const issue of [...ir, ...ac]) {
        const match = issue.identifier?.match(/^([A-Z]+)-/);
        if (match) { companyLabels[cid] = match[1]; break; }
      }
    }
  }

  return { agents, inReviewIssues, myInbox, activeIssues, blockedIssues, waitingOnMeIssues, lemaPitches, companyLabels };
}

export function buildJarvisContext(data: DashboardData, companyId?: string, obsidianNotes?: ObsidianNote[]): string {
  const activeAgents = data.agents.filter(a => a.status === 'in_progress' || a.status === 'busy');
  const activeTaskMap = new Map<string, Issue>();
  for (const issue of data.activeIssues) {
    if (issue.assigneeAgentId) activeTaskMap.set(issue.assigneeAgentId, issue);
  }

  const agentSummary = data.agents.map(a => {
    const task = activeTaskMap.get(a.id);
    return `- ${a.name}: ${task ? `working on "${task.title}" [${task.identifier}]` : 'idle'}`;
  }).join('\n');

  const reviewSummary = data.inReviewIssues.map(i =>
    `- ${i.identifier}: "${i.title}" (${i.priority} priority)`
  ).join('\n');

  // APPU issues are internal Paperclip dev tickets — not relevant to Billy's executive brief.
  // They are visible in the Agents tab. Strip them entirely from Jarvis's context.
  const nonAppuInbox = data.myInbox.filter(i => !/^APPU-/i.test(i.identifier ?? ''));
  const inboxSummary = nonAppuInbox.length > 0
    ? nonAppuInbox.map(i => `- ${i.identifier}: "${i.title}" [${i.status}] (${i.priority} priority)`).join('\n')
    : 'None (internal dev tickets visible in Agents tab, not surfaced here)';

  const waitingSummary = data.waitingOnMeIssues.map(i =>
    `- ${i.identifier}: "${i.title}" [${i.status}] (${i.priority} priority)`
  ).join('\n');

  const blockedSummary = data.blockedIssues.map(i =>
    `- ${i.identifier}: "${i.title}" (${i.priority} priority)`
  ).join('\n');

  const pitchesSummary = (data.lemaPitches ?? []).map(i => {
    const synopsis = i.description
      ? `\n  Pitch: ${i.description.replace(/\n+/g, ' ').slice(0, 350)}`
      : '';
    const statusLabel = i.status === 'in_progress' ? 'GREENLIT / IN DEVELOPMENT' : 'AWAITING REVIEW';
    return `- "${i.title}" [${statusLabel}]${synopsis}`;
  }).join('\n');

  // Agent ID map for command execution — includes companyId so Claude uses the right company
  const agentIdMap = data.agents.map(a =>
    `${a.name} → agentId:${a.id} companyId:${a.companyId ?? companyId ?? 'unknown'}`
  ).join('\n');

  // Issue ID map: all known issues across all lists
  const allIssues = [
    ...data.inReviewIssues,
    ...data.myInbox,
    ...data.activeIssues,
    ...data.blockedIssues,
    ...data.waitingOnMeIssues,
    ...(data.lemaPitches ?? []),
  ];
  const seenIds = new Set<string>();
  const issueIdMap = allIssues
    .filter(i => { if (seenIds.has(i.id)) return false; seenIds.add(i.id); return true; })
    .map(i => `${i.identifier} → ${i.id}`)
    .join('\n');

  // Hardcoded Lemon context — always injected so Jarvis has full company knowledge.
  // If the Obsidian vault is connected and the "Lemon Context" note is available,
  // that note is appended below as the authoritative/up-to-date version.
  const LEMON_BASE_CONTEXT = `LEMON STUDIOS — EXECUTIVE CONTEXT

Company: Lemon Studios (101 Producciones S.A.P.I. de C.V.) — premium Mexican film & TV production company, Mexico City. Timezone: America/Mexico_City.

ABOUT BILLY: Non-engineer, builds with AI tools (vibe coding). Takes 54mg Concerta (ADHD). Prefers voice-first, low-friction, scannable briefings.

PEOPLE & INITIALS — expand these when reading calendar events or notes aloud:
- BR = Billy Rovzar, Founder & CEO (billy@lemonfilms.com) — "BR" in calendar titles means Billy's attendance required
- FR = Fernando Rovzar, Cofounder / Creative Lead (fernando@lemonfilms.com)
- ES = Erica Sanchez Su, Head of Production (erica@lemonfilms.com)
- IT = Isaac Toussier, Head of Development (isaac@lemonfilms.com)
- HC = Heazel Cid, Billy's Executive Assistant (heazel@lemonfilms.com)
- PZ = Patrik Zielinski, CFO (patrik@lemonfilms.com)
- ON = Oliver Nava, Development Executive (oliver@lemonfilms.com)
- AL = Alejandro Lozano, Director / Cofounder

KEY EXTERNAL CONTACTS:
- Tyler Gould (tyler@magneticlabsmedia.com) — Magnetic Labs CIO (bridge loan)
- Mauricio Llanes / Lara Helguera — LLH Law (contracts)
- Crisanto Sanchez (creel.mx) — lead attorney, bridge loan term sheet
- Mauricio Martinez Vallejo (GBM) — Lemon Trust I capital markets
- Francisco Ferrandis (es.andersen.com) — Spain expansion legal

ACTIVE PRODUCTIONS:
- Los Corruptores (Netflix) — post-production (editing, VFX, ADR, PIX deliveries ep.106-108)
- Las Azules S2 (Apple TV+) — final post-production; Season 1 won International Emmy
- In development: Papa en la Luna, Oro Verde (Sony/Netflix), COLMENA, Matadero V4 (Spain/Pais Vasco), El Godin de los Cielos, LUCHA

ACTIVE BUSINESS THREADS:
- Magnetic Labs bridge loan — Aperture structure, secured against Las Azules Apple cashflows; watch: term sheet execution, DocuSign, BBVA co-signatory docs
- Lemon Trust I — $300M MXN film fund, targeting Cinepolis LP; watch: NDA signatures, LP commitment letters
- Oxido Jalisco JV — 25% stake, $7.5M MXN; watch: equity structure, COECYJAL Anexo H, vesting triggers
- Spain Expansion — Lemon Studios España; SETT application, NIF, Canarias/Pais Vasco incentives; watch: SETT meeting, NIF timeline

NOISE FILTERS — do NOT brief Billy on these unless specifically relevant:
Temu/retail promo emails, LinkedIn notifications, newsletter digests, Google security alerts (unless unknown device), Eight Sleep/consumer product emails, automated billing/receipts, Steam/gaming, Incogni updates, Interactive Brokers marketing, Eton School parent comms (mention only if deadline within 48h)

BRIEFING FORMATTING — FOLLOW STRICTLY:
- Lead with the single most important item as a "When/Then" commitment (3 seconds to read)
- Use NOW / NEXT / ORBIT structure (three buckets, not a flat list)
- Each item: who it's from + what it's about + what Billy should DO
- Include time estimates for NOW items; flag if total NOW time exceeds calendar availability
- Include one SPARK item in NOW (something Billy wants to do — creative work, fun call, build session — dopamine fuel)
- Skip anything that does not require Billy's personal attention; delegate-level items get a single grouped line at the bottom
- Never use em dashes; use commas or periods
- Spanish/English mix is normal; do not translate unless it aids clarity
`;

  const lemonContextNote = obsidianNotes?.find(n =>
    n.title.toLowerCase().replace(/[-_ ]/g, '').includes('lemoncontext') ||
    n.title.toLowerCase().includes('lemon context')
  );
  // If Obsidian has the latest Lemon Context doc, append it (takes precedence for updated facts)
  const lemonContextSection = lemonContextNote
    ? `${LEMON_BASE_CONTEXT}\nLEMON CONTEXT (live from Obsidian vault — most recent):\n${lemonContextNote.preview}\n`
    : LEMON_BASE_CONTEXT;

  const vaultSection = obsidianNotes && obsidianNotes.length > 0
    ? `OBSIDIAN VAULT NOTES (${obsidianNotes.length} notes — use these to answer questions about Billy's strategy, meetings, research, and notes):
${obsidianNotes.map(n =>
  `- "${n.title}" [${n.path}] ${n.tags.length ? `#${n.tags.join(' #')}` : ''}${n.preview ? `\n  Preview: ${n.preview}` : ''}`
).join('\n')}`
    : 'OBSIDIAN VAULT NOTES: Not connected. Set OBSIDIAN_API_URL and OBSIDIAN_API_KEY on Vercel to enable.';

  const _now = new Date();
  return `${lemonContextSection}
CURRENT DASHBOARD STATE:
Date: ${_now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Mexico_City' })}
Time: ${_now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' })} (Mexico City)
Total agents (all companies): ${data.agents.length}
Active agents: ${activeAgents.length}/${data.agents.length}
${companyId ? `Company ID (use for create_issue): ${companyId}` : ''}

AGENTS:
${agentSummary}

PENDING REVIEWS:
${reviewSummary || 'None'}

WAITING ON YOUR DECISION (${data.waitingOnMeIssues.length} issues):
${waitingSummary || 'None'}

BLOCKED ISSUES (${data.blockedIssues.length} total):
${blockedSummary || 'None'}

LEMA PITCHES (${(data.lemaPitches ?? []).length} active):
${pitchesSummary || 'None'}

MY INBOX/AGENDA:
${inboxSummary || 'None'}

AGENT ID MAP (for command execution):
${agentIdMap || 'None'}

ISSUE ID MAP (for command execution):
${issueIdMap || 'None'}

${vaultSection}`;
}

export function getCompanyId(): string {
  return COMPANY_ID_ENV.split(',')[0]?.trim() ?? '';
}

interface PitchDocument {
  key: string;
  body?: string;
  title?: string;
}

export async function fetchPitchDocuments(pitchId: string): Promise<PitchDocument[]> {
  try {
    const raw = await apiGet<unknown>(`/api/issues/${pitchId}/documents`);
    if (Array.isArray(raw)) return raw as PitchDocument[];
    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>;
      const arr = r['documents'] ?? r['data'];
      if (Array.isArray(arr)) return arr as PitchDocument[];
    }
  } catch {
    // degrade gracefully
  }
  return [];
}

export function detectPitchMediaType(title: string, description?: string): 'tv' | 'movie' {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  const tvKw = ['series', 'temporada', 'season', 'episode', 'episodio', 'limited series', 'miniseries', 'tv series', 'show', 'episodios'];
  return tvKw.some(kw => text.includes(kw)) ? 'tv' : 'movie';
}

export async function executePitchVerdict(
  projectId: string,
  verdict: 'develop' | 'resolve' | 'kill',
): Promise<void> {
  // LEMA pitches are Paperclip projects (LEMA Lemon Virtual Studios — Development Gate board).
  // Verdict is stored in billyVerdict field; queueStatus archives or decides the pitch.
  // billyVerdict values: 'approve' | 'resolve' | 'reject'
  // queueStatus values: 'awaiting_review' | 'decided' | 'archived'
  const verdictMap: Record<string, { billyVerdict: string; queueStatus: string }> = {
    develop: { billyVerdict: 'approve',  queueStatus: 'decided'  },
    resolve: { billyVerdict: 'resolve',  queueStatus: 'archived' },
    kill:    { billyVerdict: 'reject',   queueStatus: 'archived' },
  };

  const post = async (action: string, params: Record<string, unknown>) => {
    const res = await fetch('/api/paperclip-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params, companyId: LEMA_COMPANY_ID }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`[executePitchVerdict] ${action} failed ${res.status}:`, data);
      throw new Error(`${action} failed: ${res.status} — ${JSON.stringify(data)}`);
    }
    console.log(`[executePitchVerdict] ${action} OK:`, data);
    return data;
  };

  console.log(`[executePitchVerdict] projectId=${projectId} verdict=${verdict}`, verdictMap[verdict]);
  await post('patch_project', { projectId, ...verdictMap[verdict] });
  // Best-effort comment — projects may not support the issues comment endpoint
  const ts = new Date().toISOString();
  const labels = { develop: 'Greenlighted', resolve: 'Resolved', kill: 'Killed' };
  post('add_comment', { issueId: projectId, body: `${labels[verdict]} by Billy via JARVIS — ${ts}` }).catch(() => {});
}
