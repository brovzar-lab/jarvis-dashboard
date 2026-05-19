// Gmail API proxy. Uses refresh-token flow via GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN.
// Returns 204 when credentials are missing so the client falls back to demo data.
import { getGoogleAccessToken } from './_lib/google-token.js';

export default async function handler(req, res) {
  const token = await getGoogleAccessToken();
  if (!token) return res.status(204).end();

  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=in:inbox',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) return res.status(204).end();
    const { messages = [] } = await listRes.json();

    const emails = await Promise.all(messages.slice(0, 6).map(async (m) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const msg = await msgRes.json();
      const hdrs = Object.fromEntries((msg.payload?.headers ?? []).map(h => [h.name, h.value]));
      const unread = (msg.labelIds ?? []).includes('UNREAD');
      return {
        id: m.id,
        from: (hdrs.From ?? 'Unknown').replace(/<[^>]+>/, '').trim(),
        subject: hdrs.Subject ?? '(no subject)',
        preview: msg.snippet ?? '',
        time: new Date(parseInt(msg.internalDate)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        unread,
        priority: unread && (msg.labelIds ?? []).includes('IMPORTANT') ? 'high' : 'normal',
      };
    }));

    res.json(emails);
  } catch {
    res.status(204).end();
  }
}
