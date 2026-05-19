// Obsidian Local REST API proxy (obsidian-local-rest-api plugin).
// Set OBSIDIAN_API_URL (e.g. http://your-tunnel:27123) and OBSIDIAN_API_KEY.
// Without them returns 204 so the client falls back to demo data.
// Supports ?q=keyword to filter by content/title match.
export default async function handler(req, res) {
  const apiUrl = process.env.OBSIDIAN_API_URL;
  const apiKey = process.env.OBSIDIAN_API_KEY;
  if (!apiUrl || !apiKey) return res.status(204).end();

  const query = (req.query?.q ?? '').toLowerCase().trim();

  try {
    // Fetch recently modified files
    const vaultRes = await fetch(`${apiUrl}/vault/`, {
      headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' }
    });
    if (!vaultRes.ok) return res.status(204).end();
    const data = await vaultRes.json();
    const mdFiles = (data.files ?? []).filter(f => f.endsWith('.md'));

    // Fetch all notes (capped at 30 to avoid overloading the context)
    const allNotes = await Promise.all(mdFiles.slice(0, 30).map(async (filePath, i) => {
      try {
        const fileRes = await fetch(`${apiUrl}/vault/${encodeURIComponent(filePath)}`, {
          headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' }
        });
        const file = fileRes.ok ? await fileRes.json() : {};
        const content = file.content ?? '';
        const cleanContent = content.replace(/^---[\s\S]*?---/, '').trim();
        const preview = cleanContent.replace(/#+\s/g, '').slice(0, 180);
        const tags = (content.match(/tags:\s*\[([^\]]+)\]/) ?? [])[1]?.split(',').map(t => t.trim().replace(/"/g, '')) ?? [];
        return {
          id: String(i),
          title: filePath.replace(/^.*\//, '').replace('.md', ''),
          path: filePath,
          modified: 'recently',
          tags,
          preview,
          _fullContent: cleanContent,
        };
      } catch {
        return { id: String(i), title: filePath.replace(/^.*\//, '').replace('.md', ''), path: filePath, modified: '', tags: [], preview: '', _fullContent: '' };
      }
    }));

    // Filter by query if provided, otherwise return most recent 8
    let results;
    if (query) {
      results = allNotes.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n._fullContent.toLowerCase().includes(query) ||
        n.tags.some(t => t.toLowerCase().includes(query))
      );
      // If no direct match, return top 6 as context
      if (results.length === 0) results = allNotes.slice(0, 6);
    } else {
      results = allNotes.slice(0, 8);
    }

    // Strip internal field before sending
    res.json(results.map(({ _fullContent: _, ...n }) => n));
  } catch {
    res.status(204).end();
  }
}
