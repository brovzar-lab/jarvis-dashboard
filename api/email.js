// Gmail API proxy. Uses refresh-token flow via GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN.
// Returns 204 when credentials are missing so the client falls back to demo data.
// Fetches up to 25 messages from the last 21 days (inbox + archived, no trash/spam)
// so Jarvis can answer questions about past emails, not just the current 6.
import { getGoogleAccessToken } from './_lib/google-token.js';

export default async function handler(req, res) {
  const token = await getGoogleAccessToken();
  if (!token) return res.status(204).end();

  try {
    const query = encodeURIComponent('newer_than:21d -in:trash -in:spam');
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) return res.status(204).end();
    const { messages = [] } = await listRes.json();

    const emails = await Promise.all(messages.map(async (m) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const msg = await msgRes.json();
      const hdrs = Object.fromEntries((msg.payload?.headers ?? []).map(h => [h.name, h.value]));
      const unread = (msg.labelIds ?? []).includes('UNREAD');
      const inInbox = (msg.labelIds ?? []).includes('INBOX');
      const date = new Date(parseInt(msg.internalDate));
      const isToday = date.toDateString() === new Date().toDateString();
      return {
        id: m.id,
        from: (hdrs.From ?? 'Unknown').replace(/<[^>]+>/, '').trim(),
        subject: hdrs.Subject ?? '(no subject)',
        preview: msg.snippet ?? '',
        time: isToday
          ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        unread,
        inInbox,
        priority: unread && (msg.labelIds ?? []).includes('IMPORTANT') ? 'high' : 'normal',
        link: `https://mail.google.com/mail/u/0/#all/${m.id}`,
      };
    }));

    res.json(emails);
  } catch {
    res.status(204).end();
  }
}
