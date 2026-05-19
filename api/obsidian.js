// Obsidian Brain proxy — reads directly from the GitHub vault repo.
// No local tunnel required. Works from any device, always available.
//
// Mode priority:
//   1. OBSIDIAN_GITHUB_TOKEN + OBSIDIAN_GITHUB_REPO  (GitHub-backed vault, preferred)
//   2. OBSIDIAN_API_URL + OBSIDIAN_API_KEY            (local REST API tunnel, fallback)
//   3. 204 — client falls back to demo data
//
// Default load pulls the full structured vault:
//   raw/notes/ (all), wiki/deals/ (all), wiki/projects/ (all),
//   wiki/people/ (sample), wiki/companies/ (sample),
//   raw/emails/ (recent 8), raw/transcripts/ (recent 5)
//
// Query mode (?q=keyword) full-text searches across notes + wiki + emails.

const GH_TOKEN = process.env.OBSIDIAN_GITHUB_TOKEN;
const GH_REPO = process.env.OBSIDIAN_GITHUB_REPO || 'brovzar-lab/obsidian-brain';

// Fetch a raw file from GitHub (private repo, auth required)
async function ghFile(path, token, repo) {
  const res = await fetch(
    `https://raw.githubusercontent.com/${repo}/HEAD/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.ok ? res.text() : null;
}

function makeNote(path, content, index) {
  const clean = content.replace(/^---[\s\S]*?---/, '').trim();
  const isLemon = path.toLowerCase().replace(/[-_ /]/g, '').includes('lemoncontext');
  const preview = clean.replace(/#+\s/g, '').slice(0, isLemon ? 6000 : 350);
  const tags = (content.match(/tags:\s*\[([^\]]+)\]/) ?? [])[1]
    ?.split(',').map(t => t.trim().replace(/"/g, '')) ?? [];
  return {
    id: String(index),
    title: path.replace(/^.*\//, '').replace(/\.md$/, ''),
    path,
    modified: 'recently',
    tags,
    preview,
    _text: clean.toLowerCase(),
  };
}

export default async function handler(req, res) {
  const query = (req.query?.q ?? '').toLowerCase().trim();

  // ── GitHub-backed vault ──────────────────────────────────────────────────
  if (GH_TOKEN) {
    try {
      // 1. Fetch the full tree (all .md paths)
      const treeRes = await fetch(
        `https://api.github.com/repos/${GH_REPO}/git/trees/HEAD?recursive=1`,
        { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (!treeRes.ok) return res.status(204).end();
      const { tree } = await treeRes.json();
      const allMd = tree.filter(f => f.type === 'blob' && f.path.endsWith('.md')).map(f => f.path);

      // 2. Build fetch list
      let toFetch;
      if (query) {
        // Search mode: fetch notes + wiki + recent emails (avoid fetching all 482)
        toFetch = allMd.filter(p =>
          p.startsWith('raw/notes/') ||
          p.startsWith('wiki/') ||
          p.startsWith('raw/emails/')
        ).slice(0, 80);
      } else {
        // Default mode: curated load across the full vault structure
        const notes       = allMd.filter(p => p.startsWith('raw/notes/'));          // all 12
        const deals       = allMd.filter(p => p.startsWith('wiki/deals/'));          // all 10
        const projects    = allMd.filter(p => p.startsWith('wiki/projects/'));       // all 21
        const people      = allMd.filter(p => p.startsWith('wiki/people/')).slice(0, 20);
        const companies   = allMd.filter(p => p.startsWith('wiki/companies/')).slice(0, 15);
        const brain       = allMd.filter(p => p.startsWith('wiki/creative-brain/')).slice(0, 10);
        const emails      = allMd.filter(p => p.startsWith('raw/emails/')).slice(-8);
        const transcripts = allMd.filter(p => p.startsWith('raw/transcripts/')).slice(-5);
        const personal    = allMd.filter(p => p.startsWith('wiki/personal/')).slice(0, 8);
        toFetch = [...new Set([...notes, ...deals, ...projects, ...people, ...companies, ...brain, ...emails, ...transcripts, ...personal])];
      }

      // 3. Fetch content in parallel
      const fetched = await Promise.all(toFetch.map(async (path, i) => {
        const content = await ghFile(path, GH_TOKEN, GH_REPO).catch(() => null);
        if (!content) return null;
        return makeNote(path, content, i);
      }));
      const notes = fetched.filter(Boolean);

      // 4. Filter by query if needed
      let results;
      if (query) {
        const matched = notes.filter(n =>
          n.title.toLowerCase().includes(query) ||
          n._text.includes(query) ||
          n.tags.some(t => t.toLowerCase().includes(query))
        );
        results = matched.length > 0 ? matched.slice(0, 12) : notes.slice(0, 8);
      } else {
        results = notes;
      }

      // Strip internal search field before sending
      return res.json(results.map(({ _text: _, ...n }) => n));
    } catch {
      return res.status(204).end();
    }
  }

  // ── Local REST API fallback (original tunnel mode) ───────────────────────
  const apiUrl = process.env.OBSIDIAN_API_URL;
  const apiKey = process.env.OBSIDIAN_API_KEY;
  if (!apiUrl || !apiKey) return res.status(204).end();

  try {
    const vaultRes = await fetch(`${apiUrl}/vault/`, {
      headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' }
    });
    if (!vaultRes.ok) return res.status(204).end();
    const data = await vaultRes.json();
    const mdFiles = (data.files ?? []).filter(f => f.endsWith('.md'));

    const allNotes = await Promise.all(mdFiles.slice(0, 50).map(async (filePath, i) => {
      try {
        const fileRes = await fetch(`${apiUrl}/vault/${encodeURIComponent(filePath)}`, {
          headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' }
        });
        const file = fileRes.ok ? await fileRes.json() : {};
        const content = file.content ?? '';
        return makeNote(filePath, content, i);
      } catch {
        return { id: String(i), title: filePath.replace(/^.*\//, '').replace('.md', ''), path: filePath, modified: '', tags: [], preview: '', _text: '' };
      }
    }));

    const lemonNote = allNotes.find(n => n.path.toLowerCase().replace(/[-_ /]/g, '').includes('lemoncontext'));
    let results;
    if (query) {
      results = allNotes.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n._text.includes(query) ||
        n.tags.some(t => t.toLowerCase().includes(query))
      );
      if (results.length === 0) results = allNotes.slice(0, 6);
    } else {
      results = allNotes.slice(0, 10);
    }
    if (lemonNote && !results.find(n => n.id === lemonNote.id)) {
      results = [lemonNote, ...results];
    }
    return res.json(results.map(({ _text: _, ...n }) => n));
  } catch {
    res.status(204).end();
  }
}
