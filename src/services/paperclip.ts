import type { Agent, Issue, DashboardData } from '../types';
import { DEMO_DATA } from './demo-data';

const COMPANY_ID = import.meta.env.VITE_PAPERCLIP_COMPANY_ID || '';

export const isDemoMode =
  !COMPANY_ID ||
  COMPANY_ID === 'REPLACE_WITH_VALUE';

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

interface InboxItem { id: string; identifier: string; title: string; status: string; priority: string; updatedAt?: string }

export async function fetchDashboardData(): Promise<DashboardData> {
  if (isDemoMode) {
    await new Promise(r => setTimeout(r, 600));
    return DEMO_DATA;
  }

  const [agentsRes, inReviewRes, inboxRes] = await Promise.allSettled([
    apiGet<unknown>(`/api/companies/${COMPANY_ID}/agents`),
    apiGet<unknown>(`/api/companies/${COMPANY_ID}/issues?status=in_review&limit=20`),
    apiGet<unknown>(`/api/agents/me/inbox-lite`),
  ]);

  const agents: Agent[] = agentsRes.status === 'fulfilled'
    ? extractArray<Agent>(agentsRes.value, 'agents', 'data')
    : [];

  const inReviewIssues: Issue[] = inReviewRes.status === 'fulfilled'
    ? extractArray<Issue>(inReviewRes.value, 'issues', 'data')
    : [];

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

  // fetch active issues for agents
  const activeIssuesRaw = await apiGet<unknown>(
    `/api/companies/${COMPANY_ID}/issues?status=in_progress&limit=50`
  ).catch(() => []);

  const activeIssues: Issue[] = extractArray<Issue>(activeIssuesRaw, 'issues', 'data');

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
Active agents: ${activeAgents.length}/${data.agents.length}

AGENTS:
${agentSummary}

PENDING REVIEWS:
${reviewSummary || 'None'}

MY INBOX/AGENDA:
${inboxSummary || 'None'}`;
}
