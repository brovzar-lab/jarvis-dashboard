export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Support both CLAUDE_API_KEY (server-only, preferred) and VITE_CLAUDE_API_KEY (legacy)
  const apiKey = process.env.CLAUDE_API_KEY || process.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Claude API key not configured' });
    return;
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req.body),
  });

  const body = await upstream.text();
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
  res.end(body);
}
