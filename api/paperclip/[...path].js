export default async function handler(req, res) {
  const pathParts = req.query.path ?? [];
  const pathStr = Array.isArray(pathParts) ? pathParts.join('/') : pathParts;
  const cleanPath = pathStr.startsWith('api/') ? pathStr.slice(4) : pathStr;
  const query = new URL(req.url, 'http://localhost').search;
  const upstreamUrl = `${process.env.PAPERCLIP_API_URL}/api/${cleanPath}${query}`;

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
