import type { Agent, Issue, DashboardData } from '../types';
import type { ObsidianNote } from './integrations';

const BOARD_USER_ID = import.meta.env.VITE_BOARD_USER_ID || 'Ii0txDoen0NV1MLw20AKX79qv2cC6eR4';
import { DEMO_DATA } from './demo-data';

const COMPANY_ID_ENV = import.meta.env.VITE_PAPERCLIP_COMPANY_ID || '';
const LEMA_COMPANY_ID = 'ff52ad91-250b-4d9d-a2ee-1d24b65ec3e8';

export const isDemoMode =
  !COMPANY_ID_ENV ||
  COMPANY_ID_ENV === 'REPLACE_WITH_VALUE';

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
  if (isDemoMode) {
    await new Promise(r => setTimeout(r, 600));
    return DEMO_DATA;
  }

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

  // Fetch LEMA pitches if LEMA is a known company
  let lemaPitches: Issue[] = [];
  if (companyIds.includes(LEMA_COMPANY_ID)) {
    try {
      const projectsRaw = await apiGet<unknown>(`/api/companies/${LEMA_COMPANY_ID}/projects`).catch(() => null);
      let pitchProjectId: string | undefined;
      if (projectsRaw && typeof projectsRaw === 'object') {
        const projects = extractArray<{ id: string; name: string }>(projectsRaw, 'projects', 'data', 'items');
        const pitchProject = projects.find(p => /pitch/i.test(p.name));
        pitchProjectId = pitchProject?.id;
      }
      const pitchQuery = pitchProjectId
        ? `/api/companies/${LEMA_COMPANY_ID}/issues?projectId=${pitchProjectId}&status=todo,in_progress,in_review,blocked&limit=20`
        : `/api/companies/${LEMA_COMPANY_ID}/issues?q=pitch&status=todo,in_progress,in_review,blocked&limit=20`;
      const pitchesRaw = await apiGet<unknown>(pitchQuery).catch(() => []);
      lemaPitches = extractArray<Issue>(pitchesRaw, 'issues', 'data').map(i => ({
        ...i,
        companyId: LEMA_COMPANY_ID,
      }));
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

  const pitchesSummary = (data.lemaPitches ?? []).map(i =>
    `- ${i.identifier}: "${i.title}" [${i.status}] (${i.priority} priority)`
  ).join('\n');

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

  // Check for a "Lemon Context" doc in the vault — it contains comprehensive company/team info
  const lemonContextNote = obsidianNotes?.find(n =>
    n.title.toLowerCase().replace(/[-_ ]/g, '').includes('lemoncontext') ||
    n.title.toLowerCase().includes('lemon context')
  );
  const lemonContextSection = lemonContextNote
    ? `LEMON CONTEXT DOC ("${lemonContextNote.title}"):
${lemonContextNote.preview}
`
    : `LEMON FILMS TEAM — ABBREVIATIONS USED IN CALENDAR EVENTS AND NOTES:
- BR = Billy Rovzar (that's YOU — founder & CEO of Lemon Films)
  "BR" in calendar event titles means your attendance is required
- IT = Isaac Toussier
- ES = Erica Sanchez
When reading calendar events aloud, always expand initials to full names.
(Connect Obsidian vault to load the full "Lemon Context" document automatically.)
`;

  const vaultSection = obsidianNotes && obsidianNotes.length > 0
    ? `OBSIDIAN VAULT NOTES (${obsidianNotes.length} notes — use these to answer questions about Billy's strategy, meetings, research, and notes):
${obsidianNotes.map(n =>
  `- "${n.title}" [${n.path}] ${n.tags.length ? `#${n.tags.join(' #')}` : ''}${n.preview ? `\n  Preview: ${n.preview}` : ''}`
).join('\n')}`
    : 'OBSIDIAN VAULT NOTES: Not connected. Set OBSIDIAN_API_URL and OBSIDIAN_API_KEY on Vercel to enable.';

  return `${lemonContextSection}
CURRENT DASHBOARD STATE:
Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
