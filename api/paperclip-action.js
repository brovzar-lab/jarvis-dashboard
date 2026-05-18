const ALLOWED_ACTIONS = new Set(['patch_issue', 'create_issue', 'add_comment', 'get_issue']);

function resolveApiKey(companyId) {
  if (companyId) {
    const slug = companyId.replace(/-/g, '').slice(0, 8).toUpperCase();
    const key = process.env[`PAPERCLIP_API_KEY_${slug}`];
    if (key) return key;
  }
  return process.env.PAPERCLIP_API_KEY;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { action, params = {}, companyId } = req.body ?? {};

  if (!action || !ALLOWED_ACTIONS.has(action)) {
    res.status(400).json({ error: `Unknown action: ${action}` });
    return;
  }

  const apiKey = resolveApiKey(companyId);
  if (!apiKey) {
    res.status(503).json({ error: 'Paperclip API key not configured' });
    return;
  }

  const baseUrl = process.env.PAPERCLIP_API_URL;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    let upstream;

    if (action === 'patch_issue') {
      const { issueId, ...patch } = params;
      if (!issueId) { res.status(400).json({ error: 'patch_issue requires issueId' }); return; }
      const allowed = {};
      if (patch.status) allowed.status = patch.status;
      if (patch.assigneeAgentId !== undefined) allowed.assigneeAgentId = patch.assigneeAgentId;
      if (patch.priority) allowed.priority = patch.priority;
      upstream = await fetch(`${baseUrl}/api/issues/${issueId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(allowed),
      });
    } else if (action === 'create_issue') {
      if (!companyId) { res.status(400).json({ error: 'create_issue requires companyId' }); return; }
      if (!params.title) { res.status(400).json({ error: 'create_issue requires title' }); return; }
      const body = { title: params.title };
      if (params.assigneeAgentId) body.assigneeAgentId = params.assigneeAgentId;
      if (params.priority) body.priority = params.priority;
      if (params.description) body.description = params.description;
      if (params.parentId) body.parentId = params.parentId;
      upstream = await fetch(`${baseUrl}/api/companies/${companyId}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } else if (action === 'add_comment') {
      const { issueId, body: commentBody } = params;
      if (!issueId || !commentBody) {
        res.status(400).json({ error: 'add_comment requires issueId and body' });
        return;
      }
      upstream = await fetch(`${baseUrl}/api/issues/${issueId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: commentBody }),
      });
    } else if (action === 'get_issue') {
      const { issueId } = params;
      if (!issueId) { res.status(400).json({ error: 'get_issue requires issueId' }); return; }
      upstream = await fetch(`${baseUrl}/api/issues/${issueId}`, { method: 'GET', headers });
    }

    const data = await upstream.json();
    res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
