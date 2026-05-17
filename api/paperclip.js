// Route to company-specific API keys when available.
// Key naming: PAPERCLIP_API_KEY_<SLUG> where SLUG = first 8 hex chars of company UUID, uppercased, no hyphens.
// Example for ff52ad91-...: set PAPERCLIP_API_KEY_FF52AD91
function resolveApiKey(rawPath) {
  const match = rawPath.match(/companies\/([0-9a-f]{8})/i);
  if (match) {
    const slug = match[1].toUpperCase();
    const key = process.env[`PAPERCLIP_API_KEY_${slug}`];
    if (key) return key;
  }
  return process.env.PAPERCLIP_API_KEY;
}

export default async function handler(req, res) {
  // Path comes in as query param ?p=/api/companies/... from the client
  const rawPath = (req.query.p || '').replace(/^\/api\//, '');
  const upstreamUrl = `${process.env.PAPERCLIP_API_URL}/api/${rawPath}`;

  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${resolveApiKey(rawPath)}`,
      'Content-Type': 'application/json',
    },
    body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
  });

  const body = await upstream.text();
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
  res.end(body);
}
