import type { Agent, Issue, DashboardData } from '../types';
import { DEMO_DATA } from './demo-data';

const COMPANY_ID_ENV = import.meta.env.VITE_PAPERCLIP_COMPANY_ID || '';

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
  // Try dynamic discovery via /api/me/companies first
  try {
    const raw = await apiGet<unknown>('/api/me/companies');
    const companies = extractArray<{ id: string }>(raw, 'companies', 'data');
    const ids = companies.map(c => c.id).filter(Boolean);
    if (ids.length > 0) return ids;
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
      const [agentsRaw, inReviewRaw, activeRaw] = await Promise.all([
        apiGet<unknown>(`/api/companies/${cid}/agents`).catch(() => []),
        apiGet<unknown>(`/api/companies/${cid}/issues?status=in_review&limit=20`).catch(() => []),
        apiGet<unknown>(`/api/companies/${cid}/issues?status=in_progress&limit=50`).catch(() => []),
      ]);
      return {
        agents: extractArray<Agent>(agentsRaw, 'agents', 'data'),
        inReview: extractArray<Issue>(inReviewRaw, 'issues', 'data'),
        active: extractArray<Issue>(activeRaw, 'issues', 'data'),
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

  if (companyResults.status === 'fulfilled') {
    for (const { agents: a, inReview: ir, active: ac } of companyResults.value) {
      for (const agent of a) {
        if (!seenAgents.has(agent.id)) { seenAgents.add(agent.id); agents.push(agent); }
      }
      for (const issue of ir) {
        if (!seenIssues.has(issue.id)) { seenIssues.add(issue.id); inReviewIssues.push(issue); }
      }
      for (const issue of ac) {
        if (!seenIssues.has(issue.id)) { seenIssues.add(issue.id); activeIssues.push(issue); }
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

  return { agents, inReviewIssues, myInbox, activeIssues };
}

export function buildJarvisContext(data: DashboardData): string {
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

  const inboxSummary = data.myInbox.map(i =>
    `- ${i.identifier}: "${i.title}" [${i.status}] (${i.priority} priority)`
  ).join('\n');

  return `CURRENT DASHBOARD STATE:
Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Total agents (all companies): ${data.agents.length}
Active agents: ${activeAgents.length}/${data.agents.length}

AGENTS:
${agentSummary}

PENDING REVIEWS:
${reviewSummary || 'None'}

MY INBOX/AGENDA:
${inboxSummary || 'None'}`;
}
