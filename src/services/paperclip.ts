import type { Agent, Issue, DashboardData } from '../types';
import { DEMO_DATA } from './demo-data';

const COMPANY_ID = import.meta.env.VITE_PAPERCLIP_COMPANY_ID || '';

export const isDemoMode =
  !COMPANY_ID ||
  COMPANY_ID === 'REPLACE_WITH_VALUE';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/paperclip${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

interface AgentsResponse { agents?: Agent[]; data?: Agent[] }
interface IssuesResponse { issues?: Issue[]; data?: Issue[] }
interface InboxItem { id: string; identifier: string; title: string; status: string; priority: string; updatedAt: string }
interface InboxResponse { items?: InboxItem[]; issues?: Issue[]; data?: Issue[] }

export async function fetchDashboardData(): Promise<DashboardData> {
  if (isDemoMode) {
    await new Promise(r => setTimeout(r, 600));
    return DEMO_DATA;
  }

  const [agentsRes, inReviewRes, inboxRes] = await Promise.allSettled([
    apiGet<AgentsResponse>(`/api/companies/${COMPANY_ID}/agents`),
    apiGet<IssuesResponse>(`/api/companies/${COMPANY_ID}/issues?status=in_review&limit=20`),
    apiGet<InboxResponse>(`/api/agents/me/inbox-lite`),
  ]);

  const agents: Agent[] = agentsRes.status === 'fulfilled'
    ? (agentsRes.value.agents ?? agentsRes.value.data ?? [])
    : [];

  const inReviewIssues: Issue[] = inReviewRes.status === 'fulfilled'
    ? (inReviewRes.value.issues ?? inReviewRes.value.data ?? [])
    : [];

  const inboxRaw = inboxRes.status === 'fulfilled'
    ? (inboxRes.value.items ?? inboxRes.value.issues ?? inboxRes.value.data ?? [])
    : [];

  const myInbox: Issue[] = inboxRaw.map((item) => ({
    id: item.id,
    identifier: item.identifier,
    title: item.title,
    status: item.status,
    priority: item.priority,
    updatedAt: item.updatedAt,
  }));

  // fetch active issues for agents
  const activeIssuesRes = await apiGet<IssuesResponse>(
    `/api/companies/${COMPANY_ID}/issues?status=in_progress&limit=50`
  ).catch(() => ({ issues: [] as Issue[] }));

  const activeIssues: Issue[] = (activeIssuesRes.issues ?? activeIssuesRes.data ?? []);

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
