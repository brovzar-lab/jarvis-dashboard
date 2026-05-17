export default async function handler(req, res) {
  // Path comes in as query param ?p=/api/companies/... from the client
  const rawPath = (req.query.p || '').replace(/^\/api\//, '');
  const upstreamUrl = `${process.env.PAPERCLIP_API_URL}/api/${rawPath}`;

  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${process.env.PAPERCLIP_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
  });

  const body = await upstream.text();
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
  res.end(body);
}
