// Gmail keyword search over the last N days. Used by Jarvis for per-query context injection.
// Returns top 10 matching emails (metadata + snippet). Falls back to 204 when credentials are missing.
import { getGoogleAccessToken } from '../_lib/google-token.js';

export default async function handler(req, res) {
  const token = await getGoogleAccessToken();
  if (!token) return res.status(204).end();

  const q = (req.query?.q ?? '').trim();
  const days = Math.min(parseInt(req.query?.days ?? '180', 10) || 180, 180);

  if (!q) return res.json([]);

  try {
    const gmailQuery = encodeURIComponent(`newer_than:${days}d ${q} -in:trash -in:spam`);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${gmailQuery}`,
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
      const date = new Date(parseInt(msg.internalDate));
      return {
        id: m.id,
        from: (hdrs.From ?? 'Unknown').replace(/<[^>]+>/, '').trim(),
        subject: hdrs.Subject ?? '(no subject)',
        preview: msg.snippet ?? '',
        time: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        unread: (msg.labelIds ?? []).includes('UNREAD'),
        inInbox: (msg.labelIds ?? []).includes('INBOX'),
        priority: (msg.labelIds ?? []).includes('UNREAD') && (msg.labelIds ?? []).includes('IMPORTANT') ? 'high' : 'normal',
      };
    }));

    res.json(emails);
  } catch {
    res.status(204).end();
  }
}
