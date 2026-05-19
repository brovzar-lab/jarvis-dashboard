// Shared Obsidian Local REST API client.
// All reads/writes use OBSIDIAN_API_URL + OBSIDIAN_API_KEY (Vercel secrets).
// Never import this from client-side React code — server only.

const API_URL = process.env.OBSIDIAN_API_URL;
const API_KEY = process.env.OBSIDIAN_API_KEY;

export function isObsidianConfigured() {
  return !!(API_URL && API_KEY);
}

// Encode a vault path: encode spaces per segment but preserve slashes.
function encodePath(path) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function ensureMd(path) {
  return path.endsWith('.md') ? path : `${path}.md`;
}

export { ensureMd };

// Read a vault file. Returns string content or null if missing/unreachable.
export async function obsidianGet(path) {
  if (!isObsidianConfigured()) return null;
  try {
    const res = await fetch(`${API_URL}/vault/${encodePath(path)}`, {
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content ?? null;
  } catch {
    return null;
  }
}

// List files in a vault directory. Returns array of full vault paths.
export async function obsidianList(dir) {
  if (!isObsidianConfigured()) return [];
  const dirPath = dir.endsWith('/') ? dir : `${dir}/`;
  try {
    const res = await fetch(`${API_URL}/vault/${encodePath(dirPath)}`, {
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.files) ? data.files : [];
  } catch {
    return [];
  }
}

// Write or overwrite a vault file with markdown content.
export async function obsidianPut(path, content) {
  if (!isObsidianConfigured()) return false;
  try {
    const res = await fetch(`${API_URL}/vault/${encodePath(path)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'text/markdown',
      },
      body: content,
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}
