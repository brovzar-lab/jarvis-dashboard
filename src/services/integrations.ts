export interface Email {
  id: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  priority?: 'high' | 'normal';
}

export interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: 'meeting' | 'focus' | 'deadline' | 'personal';
  attendees?: number;
  past?: boolean;
}

export interface ObsidianNote {
  id: string;
  title: string;
  path: string;
  modified: string;
  tags: string[];
  preview: string;
}

const DEMO_EMAILS: Email[] = [
  { id: 'e1', from: 'Accel Partners', subject: 'Series A term sheet — please review', preview: 'Attached is the term sheet we discussed. Happy to jump on a call to walk through the details...', time: '9:41 AM', unread: true, priority: 'high' },
  { id: 'e2', from: 'Sequoia Capital', subject: 'Re: Intro — Thursday 2pm works', preview: 'We reviewed your deck and the team profile. Thursday works great for us. Looking forward to it...', time: '8:12 AM', unread: true, priority: 'high' },
  { id: 'e3', from: 'Y Combinator', subject: 'Demo Day follow-up questions', preview: 'Congrats again on Demo Day! We had a few follow-up questions about your go-to-market strategy...', time: 'Yesterday', unread: true, priority: 'high' },
  { id: 'e4', from: 'AWS Activate', subject: 'Your $100k credits are approved', preview: 'Great news! Your AWS Activate credits have been approved and added to your account...', time: 'Yesterday', unread: false },
  { id: 'e5', from: 'Stripe', subject: 'MRR grew 34% this month 🚀', preview: 'Your Stripe dashboard shows your strongest month yet. Monthly recurring revenue hit $28,400...', time: 'Mon', unread: false },
];

function getHourLabel(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${ampm}`;
}

function buildDemoEvents(): CalendarEvent[] {
  const now = new Date();
  const h = now.getHours();
  return [
    { id: 'c1', title: 'BR — Investor call Accel Partners', time: getHourLabel(10), duration: '45m', type: 'meeting', attendees: 3, past: h > 10 },
    { id: 'c2', title: 'BR — Series A review', time: getHourLabel(14), duration: '1h', type: 'meeting', attendees: 5, past: h > 15 },
    { id: 'c3', title: 'BR — Pitch rehearsal Sequoia deck', time: getHourLabel(16), duration: '1h', type: 'meeting', attendees: 2, past: h > 17 },
  ];
}

const DEMO_NOTES: ObsidianNote[] = [
  { id: 'n1', title: 'Series A Strategy', path: 'Fundraising/Series A Strategy.md', modified: '2h ago', tags: ['fundraising', 'strategy'], preview: 'Key ask: $4M at $20M pre-money. Accel and Sequoia both engaged. Sequoia moving faster...' },
  { id: 'n2', title: 'Product Roadmap Q3', path: 'Product/Q3 Roadmap.md', modified: '5h ago', tags: ['product', 'roadmap'], preview: 'Focus areas: Jarvis V2 launch, mobile beta with push, enterprise auth, multi-tenant billing...' },
  { id: 'n3', title: 'YC Follow-up Meeting', path: 'Meetings/YC Follow-up.md', modified: '1d ago', tags: ['meeting', 'yc'], preview: 'Discussed distribution strategy. They want to see DAU/MAU ratio above 0.4 before Series A...' },
  { id: 'n4', title: 'Competitive Landscape', path: 'Strategy/Competitive Landscape.md', modified: '2d ago', tags: ['strategy', 'research'], preview: 'Linear, Notion, and Monday are the main competitors. Our AI-native angle is differentiated...' },
];

export async function fetchEmails(): Promise<Email[]> {
  try {
    const res = await fetch('/api/email');
    if (res.ok && res.status !== 204) return res.json();
  } catch { /* fallthrough */ }
  await new Promise(r => setTimeout(r, 300));
  return DEMO_EMAILS;
}

export async function fetchCalendar(): Promise<CalendarEvent[]> {
  try {
    const res = await fetch('/api/calendar');
    if (res.ok && res.status !== 204) return res.json();
  } catch { /* fallthrough */ }
  await new Promise(r => setTimeout(r, 200));
  return buildDemoEvents();
}

export async function fetchObsidian(): Promise<ObsidianNote[]> {
  try {
    const res = await fetch('/api/obsidian');
    if (res.ok && res.status !== 204) return res.json();
  } catch { /* fallthrough */ }
  await new Promise(r => setTimeout(r, 150));
  return DEMO_NOTES;
}
