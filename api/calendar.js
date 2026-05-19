// Google Calendar API proxy. Uses refresh-token flow via GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN.
// Returns 204 when credentials are missing so the client falls back to demo data.
import { getGoogleAccessToken } from './_lib/google-token.js';

export default async function handler(req, res) {
  const token = await getGoogleAccessToken();
  if (!token) return res.status(204).end();

  try {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now.toISOString())}&timeMax=${encodeURIComponent(endOfDay.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!calRes.ok) return res.status(204).end();
    const { items = [] } = await calRes.json();

    const events = items.map(e => {
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
      };
    });

    res.json(events);
  } catch {
    res.status(204).end();
  }
}
