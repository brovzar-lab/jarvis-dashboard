// Shared Google OAuth2 refresh-token helper for Vercel serverless functions.
// Reads GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN from env.
// Returns null when any var is missing (triggers 204 fallback in callers).
let cached = { token: null, expiresAt: 0 };

export async function getGoogleAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) return null;
  if (cached.token && Date.now() < cached.expiresAt) return cached.token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const { access_token, expires_in } = await res.json();
  cached = { token: access_token, expiresAt: Date.now() + (expires_in - 60) * 1000 };
  return access_token;
}
