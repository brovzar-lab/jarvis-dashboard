export interface Email {
  id: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  priority?: 'high' | 'normal';
  link?: string;
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



export async function fetchEmails(): Promise<Email[]> {
  try {
    const res = await fetch('/api/email');
    if (res.ok && res.status !== 204) return res.json();
  } catch { /* fallthrough */ }
  return [];
}

export async function fetchCalendar(): Promise<CalendarEvent[]> {
  try {
    const res = await fetch('/api/calendar');
    if (res.ok && res.status !== 204) return res.json();
  } catch { /* fallthrough */ }
  return [];
}

export async function fetchObsidian(): Promise<ObsidianNote[]> {
  try {
    const res = await fetch('/api/obsidian');
    if (res.ok && res.status !== 204) return res.json();
  } catch { /* fallthrough */ }
  return [];
}

export async function searchEmails(query: string, days = 180): Promise<Email[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(`/api/email/search?q=${encodeURIComponent(query)}&days=${days}`);
    if (res.ok && res.status !== 204) return res.json();
  } catch { /* fallthrough */ }
  return [];
}

export async function searchObsidian(query: string): Promise<ObsidianNote[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(`/api/obsidian?q=${encodeURIComponent(query)}`);
    if (res.ok && res.status !== 204) return res.json();
  } catch { /* fallthrough */ }
  return [];
}
