// Google Calendar API proxy. Uses refresh-token flow via GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN.
// Returns 204 when credentials are missing so the client falls back to demo data.
//
// Calendar selection (in priority order):
//   1. GOOGLE_CALENDAR_ID env var — explicit override
//   2. Auto-discover: first calendar in calendarList whose name contains "lemon" (case-insensitive)
//   3. Fall back to "primary"
//
// Event filter: only events with "BR" in the title are returned.
// "BR" is Billy's shorthand for events where his attendance is required.
import { getGoogleAccessToken } from './_lib/google-token.js';

async function resolveCalendarId(token) {
  // Explicit override takes highest priority
  if (process.env.GOOGLE_CALENDAR_ID) return process.env.GOOGLE_CALENDAR_ID;

  try {
    const listRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (listRes.ok) {
      const { items = [] } = await listRes.json();
      const lemon = items.find(c =>
        (c.summary ?? '').toLowerCase().includes('lemon') ||
        (c.summaryOverride ?? '').toLowerCase().includes('lemon')
      );
      if (lemon) return lemon.id;
    }
  } catch {
    // fall through to primary
  }
  return 'primary';
}

export default async function handler(req, res) {
  const token = await getGoogleAccessToken();
  if (!token) return res.status(204).end();

  try {
    const calendarId = await resolveCalendarId(token);

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch more results so we have enough after the BR filter
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(now.toISOString())}&timeMax=${encodeURIComponent(endOfDay.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!calRes.ok) return res.status(204).end();
    const { items = [] } = await calRes.json();

    // Only keep events with "BR" in the title (Billy's attendance-required marker)
    const brEvents = items.filter(e => (e.summary ?? '').includes('BR'));

    const events = brEvents.map(e => {
      const start = new Date(e.start?.dateTime ?? e.start?.date);
      const end = new Date(e.end?.dateTime ?? e.end?.date);
      const durationMin = e.end?.dateTime ? Math.round((end - start) / 60000) : 0;
      const title = (e.summary ?? 'Untitled').toLowerCase();
      const type = title.includes('focus') || title.includes('deep work') ? 'focus'
        : title.includes('deadline') || title.includes('due') ? 'deadline'
        : 'meeting';
      return {
        id: e.id,
        title: e.summary ?? 'Untitled',
        time: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        duration: durationMin > 0 ? `${durationMin >= 60 ? `${Math.floor(durationMin / 60)}h` : ''}${durationMin % 60 > 0 ? `${durationMin % 60}m` : ''}` : '',
        type,
        attendees: (e.attendees ?? []).length,
        past: end < now,
        calendarId,
      };
    });

    res.json(events);
  } catch {
    res.status(204).end();
  }
}
