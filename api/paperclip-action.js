const ALLOWED_ACTIONS = new Set(['patch_issue', 'patch_project', 'create_issue', 'add_comment', 'get_issue', 'trigger_heartbeat']);

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

  // Use let so create_issue can override companyId with the agent's actual company
  let { action, params = {}, companyId } = req.body ?? {};

  if (!action || !ALLOWED_ACTIONS.has(action)) {
    res.status(400).json({ error: `Unknown action: ${action}` });
    return;
  }

  const baseUrl = process.env.PAPERCLIP_API_URL;

  try {
    let upstream;

    if (action === 'patch_issue') {
      const { issueId, ...patch } = params;
      if (!issueId) { res.status(400).json({ error: 'patch_issue requires issueId' }); return; }
      const apiKey = resolveApiKey(companyId);
      if (!apiKey) { res.status(503).json({ error: 'Paperclip API key not configured' }); return; }
      const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      const allowed = {};
      if (patch.status) allowed.status = patch.status;
      if (patch.assigneeAgentId !== undefined) allowed.assigneeAgentId = patch.assigneeAgentId;
      if (patch.priority) allowed.priority = patch.priority;
      upstream = await fetch(`${baseUrl}/api/issues/${issueId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(allowed),
      });
    } else if (action === 'patch_project') {
      const { projectId, ...patch } = params;
      if (!projectId) { res.status(400).json({ error: 'patch_project requires projectId' }); return; }
      const apiKey = resolveApiKey(companyId);
      if (!apiKey) { res.status(503).json({ error: 'Paperclip API key not configured' }); return; }
      const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      const allowed = {};
      if (patch.status) allowed.status = patch.status;
      if (patch.billyVerdict !== undefined) allowed.billyVerdict = patch.billyVerdict;
      if (patch.queueStatus !== undefined) allowed.queueStatus = patch.queueStatus;
      upstream = await fetch(`${baseUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(allowed),
      });
    } else if (action === 'create_issue') {
      // Claude passes companyId in params to target the agent's actual company (multi-company support)
      const effectiveCompanyId = params.companyId || companyId;
      if (!effectiveCompanyId) { res.status(400).json({ error: 'create_issue requires companyId' }); return; }
      if (!params.title) { res.status(400).json({ error: 'create_issue requires title' }); return; }
      // Resolve API key for the agent's company — may differ from the caller's primary company
      const apiKey = resolveApiKey(effectiveCompanyId);
      if (!apiKey) { res.status(503).json({ error: 'Paperclip API key not configured' }); return; }
      const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      const body = { title: params.title };
      if (params.assigneeAgentId) body.assigneeAgentId = params.assigneeAgentId;
      if (params.priority) body.priority = params.priority;
      if (params.description) body.description = params.description;
      if (params.parentId) body.parentId = params.parentId;
      upstream = await fetch(`${baseUrl}/api/companies/${effectiveCompanyId}/issues`, {
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
      const apiKey = resolveApiKey(companyId);
      if (!apiKey) { res.status(503).json({ error: 'Paperclip API key not configured' }); return; }
      const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      upstream = await fetch(`${baseUrl}/api/issues/${issueId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: commentBody }),
      });
    } else if (action === 'get_issue') {
      const { issueId } = params;
      if (!issueId) { res.status(400).json({ error: 'get_issue requires issueId' }); return; }
      const apiKey = resolveApiKey(companyId);
      if (!apiKey) { res.status(503).json({ error: 'Paperclip API key not configured' }); return; }
      const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      upstream = await fetch(`${baseUrl}/api/issues/${issueId}`, { method: 'GET', headers });
    } else if (action === 'trigger_heartbeat') {
      const { agentId } = params;
      if (!agentId) { res.status(400).json({ error: 'trigger_heartbeat requires agentId' }); return; }
      const apiKey = resolveApiKey(companyId);
      if (!apiKey) { res.status(503).json({ error: 'Paperclip API key not configured' }); return; }
      const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      upstream = await fetch(`${baseUrl}/api/agents/${agentId}/heartbeat`, { method: 'POST', headers, body: JSON.stringify({}) });
    }

    const data = await upstream.json();
    res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
