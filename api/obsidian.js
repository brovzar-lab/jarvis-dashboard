// Obsidian Local REST API proxy (obsidian-local-rest-api plugin).
// Set OBSIDIAN_API_URL (e.g. http://your-tunnel:27123) and OBSIDIAN_API_KEY.
// Without them returns 204 so the client falls back to demo data.
export default async function handler(req, res) {
  const apiUrl = process.env.OBSIDIAN_API_URL;
  const apiKey = process.env.OBSIDIAN_API_KEY;
  if (!apiUrl || !apiKey) return res.status(204).end();

  try {
    // Fetch recently modified files
    const vaultRes = await fetch(`${apiUrl}/vault/`, {
      headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' }
    });
    if (!vaultRes.ok) return res.status(204).end();
    const data = await vaultRes.json();
    const mdFiles = (data.files ?? []).filter(f => f.endsWith('.md')).slice(0, 6);

    const notes = await Promise.all(mdFiles.map(async (filePath, i) => {
      try {
        const fileRes = await fetch(`${apiUrl}/vault/${encodeURIComponent(filePath)}`, {
          headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' }
        });
        const file = fileRes.ok ? await fileRes.json() : {};
        const content = file.content ?? '';
        const preview = content.replace(/^---[\s\S]*?---/, '').replace(/#+\s/g, '').trim().slice(0, 120);
        const tags = (content.match(/tags:\s*\[([^\]]+)\]/) ?? [])[1]?.split(',').map(t => t.trim().replace(/"/g, '')) ?? [];
        return {
          id: String(i),
          title: filePath.replace(/^.*\//, '').replace('.md', ''),
          path: filePath,
          modified: 'recently',
          tags,
          preview,
        };
      } catch {
        return { id: String(i), title: filePath.replace(/^.*\//, '').replace('.md', ''), path: filePath, modified: '', tags: [], preview: '' };
      }
    }));

    res.json(notes);
  } catch {
    res.status(204).end();
  }
}
