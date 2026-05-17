import type { Agent, Issue, DashboardData } from '../types';

const DEMO_AGENTS: Agent[] = [
  { id: 'a1', name: 'Lead App Engineer', nameKey: 'lead-app-engineer', status: 'in_progress', currentTask: 'Build Jarvis dashboard', currentTaskId: 'APPU-509' },
  { id: 'a2', name: 'Senior Web Engineer', nameKey: 'senior-web-engineer', status: 'in_progress', currentTask: 'React component library', currentTaskId: 'APPU-488' },
  { id: 'a3', name: 'Senior Web Engineer II', nameKey: 'senior-web-engineer-ii', status: 'in_progress', currentTask: 'API integration layer', currentTaskId: 'APPU-492' },
  { id: 'a4', name: 'Head of Design', nameKey: 'head-of-design', status: 'idle', currentTask: undefined },
  { id: 'a5', name: 'Senior Mobile Engineer iOS', nameKey: 'senior-mobile-ios', status: 'in_progress', currentTask: 'Push notification system', currentTaskId: 'APPU-501' },
  { id: 'a6', name: 'Senior Mobile Engineer Android', nameKey: 'senior-mobile-android', status: 'in_progress', currentTask: 'Offline sync module', currentTaskId: 'APPU-503' },
  { id: 'a7', name: 'QA Engineer', nameKey: 'qa-engineer', status: 'idle', currentTask: undefined },
  { id: 'a8', name: 'Debugger', nameKey: 'debugger', status: 'idle', currentTask: undefined },
  { id: 'a9', name: 'Product Tester', nameKey: 'product-tester', status: 'idle', currentTask: undefined },
  { id: 'a10', name: 'CEO', nameKey: 'ceo', status: 'in_progress', currentTask: 'Jarvis dashboard spec', currentTaskId: 'APPU-507' },
  { id: 'a11', name: 'CTO', nameKey: 'cto', status: 'idle', currentTask: undefined },
  { id: 'a12', name: 'Product Manager', nameKey: 'product-manager', status: 'in_progress', currentTask: 'Q2 roadmap planning', currentTaskId: 'APPU-445' },
];

const DEMO_REVIEW_ISSUES: Issue[] = [
  { id: 'i1', identifier: 'APPU-480', title: 'Authentication flow redesign', status: 'in_review', priority: 'high', updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'i2', identifier: 'APPU-495', title: 'Mobile push notification integration', status: 'in_review', priority: 'medium', updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'i3', identifier: 'APPU-471', title: 'Database schema migration v2', status: 'in_review', priority: 'critical', updatedAt: new Date(Date.now() - 1800000).toISOString() },
];

const DEMO_INBOX: Issue[] = [
  { id: 'i4', identifier: 'APPU-509', title: 'Build Jarvis AI executive dashboard', status: 'in_progress', priority: 'high', updatedAt: new Date().toISOString() },
  { id: 'i5', identifier: 'APPU-510', title: 'Review mobile CI/CD pipeline', status: 'todo', priority: 'medium', updatedAt: new Date(Date.now() - 900000).toISOString() },
  { id: 'i6', identifier: 'APPU-512', title: 'Code review: API rate limiting', status: 'todo', priority: 'high', updatedAt: new Date(Date.now() - 1200000).toISOString() },
];

export const DEMO_DATA: DashboardData = {
  agents: DEMO_AGENTS,
  inReviewIssues: DEMO_REVIEW_ISSUES,
  myInbox: DEMO_INBOX,
  activeIssues: DEMO_AGENTS.filter(a => a.currentTask).map(a => ({
    id: a.id + '-task',
    identifier: a.currentTaskId ?? '',
    title: a.currentTask ?? '',
    status: 'in_progress',
    priority: 'medium',
    assigneeAgentId: a.id,
    updatedAt: new Date().toISOString(),
  })),
};
