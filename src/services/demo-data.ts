import type { Agent, Issue, DashboardData } from '../types';

const APPU_ID = 'appu-demo';
const LEMA_ID = 'lema-demo';

const DEMO_AGENTS: Agent[] = [
  { id: 'a1', name: 'Lead App Engineer', nameKey: 'lead-app-engineer', status: 'in_progress', currentTask: 'Build Jarvis dashboard', currentTaskId: 'APPU-509', companyId: APPU_ID, role: 'engineer', title: 'Lead Application Engineer' },
  { id: 'a2', name: 'Senior Web Engineer', nameKey: 'senior-web-engineer', status: 'in_progress', currentTask: 'React component library', currentTaskId: 'APPU-488', companyId: APPU_ID, role: 'engineer', title: 'Senior Full-Stack Engineer (Web)' },
  { id: 'a3', name: 'Senior Web Engineer II', nameKey: 'senior-web-engineer-ii', status: 'in_progress', currentTask: 'Agent behaviors panel', currentTaskId: 'APPU-617', companyId: APPU_ID, role: 'engineer', title: 'Senior Full-Stack Engineer (Web) II' },
  { id: 'a4', name: 'Head of Design', nameKey: 'head-of-design', status: 'idle', currentTask: undefined, companyId: APPU_ID, role: 'designer', title: 'Head of Design' },
  { id: 'a5', name: 'Senior Mobile Engineer iOS', nameKey: 'senior-mobile-ios', status: 'in_progress', currentTask: 'Push notification system', currentTaskId: 'APPU-501', companyId: APPU_ID, role: 'engineer', title: 'Senior Mobile Engineer (iOS Focus)' },
  { id: 'a6', name: 'Senior Mobile Engineer Android', nameKey: 'senior-mobile-android', status: 'in_progress', currentTask: 'Offline sync module', currentTaskId: 'APPU-503', companyId: APPU_ID, role: 'engineer', title: 'Senior Mobile Engineer (Android Focus)' },
  { id: 'a7', name: 'QA Engineer', nameKey: 'qa-engineer', status: 'idle', currentTask: undefined, companyId: APPU_ID, role: 'qa', title: 'QA Engineer' },
  { id: 'a8', name: 'Debugger', nameKey: 'debugger', status: 'idle', currentTask: undefined, companyId: APPU_ID, role: 'engineer', title: 'Debugger / Bug Fix Engineer' },
  { id: 'a9', name: 'Product Tester', nameKey: 'product-tester', status: 'idle', currentTask: undefined, companyId: APPU_ID, role: 'qa', title: 'Product Tester (UX)' },
  { id: 'a10', name: 'CEO', nameKey: 'ceo', status: 'in_progress', currentTask: 'Jarvis dashboard spec', currentTaskId: 'APPU-507', companyId: APPU_ID, role: 'ceo', title: 'Chief Executive Officer' },
  { id: 'a11', name: 'CTO', nameKey: 'cto', status: 'idle', currentTask: undefined, companyId: APPU_ID, role: 'cto', title: 'Chief Technology Officer' },
  { id: 'a12', name: 'Product Manager', nameKey: 'product-manager', status: 'in_progress', currentTask: 'Q2 roadmap planning', currentTaskId: 'APPU-445', companyId: APPU_ID, role: 'pm', title: 'Product Manager' },
  // LEMA agents
  { id: 'l1', name: 'CEO', nameKey: 'ceo', status: 'in_progress', currentTask: 'Series A pitch deck', currentTaskId: 'LEMA-101', companyId: LEMA_ID, role: 'ceo', title: 'Chief Executive Officer' },
  { id: 'l2', name: 'Lead Engineer', nameKey: 'lead-engineer', status: 'in_progress', currentTask: 'Auth service migration', currentTaskId: 'LEMA-93', companyId: LEMA_ID, role: 'engineer', title: 'Lead Application Engineer' },
  { id: 'l3', name: 'Product Manager', nameKey: 'product-manager', status: 'in_progress', currentTask: 'Investor data room setup', currentTaskId: 'LEMA-90', companyId: LEMA_ID, role: 'pm', title: 'Product Manager' },
  { id: 'l4', name: 'CMO', nameKey: 'cmo', status: 'idle', currentTask: undefined, companyId: LEMA_ID, role: 'cmo', title: 'Chief Marketing Officer' },
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

const DEMO_BLOCKED: Issue[] = [
  { id: 'b1', identifier: 'APPU-477', title: 'Deploy auth service to production', status: 'blocked', priority: 'critical', updatedAt: new Date(Date.now() - 10800000).toISOString() },
  { id: 'b2', identifier: 'LEMA-93', title: 'Migrate user data to new schema', status: 'blocked', priority: 'high', updatedAt: new Date(Date.now() - 14400000).toISOString() },
  { id: 'b3', identifier: 'APPU-512', title: 'Enable 2FA for board users', status: 'blocked', priority: 'medium', updatedAt: new Date(Date.now() - 21600000).toISOString() },
];

const DEMO_WAITING: Issue[] = [
  { id: 'w1', identifier: 'APPU-480', title: 'Authentication flow redesign', status: 'in_review', priority: 'high', updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'w2', identifier: 'APPU-507', title: 'Jarvis dashboard spec approval', status: 'in_review', priority: 'high', updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'w3', identifier: 'LEMA-88', title: 'Q2 budget approval needed', status: 'todo', priority: 'medium', updatedAt: new Date(Date.now() - 18000000).toISOString() },
];

const DEMO_PITCHES: Issue[] = [
  {
    id: 'p1', identifier: '', title: 'El Presidente', status: 'in_review', priority: 'high',
    updatedAt: new Date(Date.now() - 3600000).toISOString(), companyId: 'ff52ad91-250b-4d9d-a2ee-1d24b65ec3e8',
    description: 'A disgraced Mexican senator uncovers a billion-peso corruption ring inside his own party and realizes he is the last honest man in the room. 8-episode limited series. Tone: Narcos meets House of Cards. Comps: El Chapo, El Candidato, The Wire.',
  },
  {
    id: 'p2', identifier: '', title: 'Fuego Negro', status: 'in_review', priority: 'high',
    updatedAt: new Date(Date.now() - 7200000).toISOString(), companyId: 'ff52ad91-250b-4d9d-a2ee-1d24b65ec3e8',
    description: 'Feature film. A wildfire photographer embedded in a cartel-controlled Sierra Madre discovers the fires are being set deliberately. Race against time in stunning landscape. Tone: Fire of Love meets No Country for Old Men. Comps: Sicario, Wind River.',
  },
  {
    id: 'p3', identifier: '', title: 'Las Hijas del Desierto', status: 'in_review', priority: 'medium',
    updatedAt: new Date(Date.now() - 10800000).toISOString(), companyId: 'ff52ad91-250b-4d9d-a2ee-1d24b65ec3e8',
    description: 'Three sisters in Ciudad Juárez inherit their father\'s cartel empire and have 30 days to dismantle it before the DEA closes in. 6-episode limited series. Tone: Succession meets Ozark with a Mexican female lens. Comps: Ozark, Maid, Bad Sisters.',
  },
  {
    id: 'p4', identifier: '', title: 'Astro', status: 'in_review', priority: 'medium',
    updatedAt: new Date(Date.now() - 14400000).toISOString(), companyId: 'ff52ad91-250b-4d9d-a2ee-1d24b65ec3e8',
    description: 'Feature film. Mexico\'s first amateur astronaut trains in secret to reach the ISS and discovers his mission is cover for a geopolitical deal he wants no part of. Tone: First Man meets Argo. Commercial adventure with real stakes and national pride engine.',
  },
  {
    id: 'p5', identifier: '', title: 'La Bestia', status: 'in_review', priority: 'low',
    updatedAt: new Date(Date.now() - 21600000).toISOString(), companyId: 'ff52ad91-250b-4d9d-a2ee-1d24b65ec3e8',
    description: 'Feature film. A Central American boy rides the infamous freight train north toward the US border and befriends a veteran migrant smuggler with a dark past. Tone: Roma meets Beasts of the Southern Wild. Awards-season drama with crossover commercial potential.',
  },
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
    companyId: a.companyId,
    updatedAt: new Date().toISOString(),
  })),
  blockedIssues: DEMO_BLOCKED,
  waitingOnMeIssues: DEMO_WAITING,
  lemaPitches: DEMO_PITCHES,
  companyLabels: {
    [APPU_ID]: 'APPU',
    [LEMA_ID]: 'LEMA',
  },
};
