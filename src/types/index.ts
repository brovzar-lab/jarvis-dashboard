export interface Agent {
  id: string;
  name: string;
  nameKey: string;
  status?: string;
  currentTask?: string;
  currentTaskId?: string;
}

export interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId?: string;
  assigneeAgent?: Agent;
  updatedAt: string;
  projectId?: string;
}

export interface DashboardData {
  agents: Agent[];
  inReviewIssues: Issue[];
  myInbox: Issue[];
  activeIssues: Issue[];
  blockedIssues: Issue[];
  waitingOnMeIssues: Issue[];
  dashboardSummary?: Record<string, unknown>;
}

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface ConversationEntry {
  id: string;
  role: 'user' | 'jarvis';
  text: string;
  timestamp: Date;
}
