// Returns the list of Paperclip company IDs that the server has API keys for.
//
// Primary company IDs: read from VITE_PAPERCLIP_COMPANY_ID (comma-separated).
//
// Additional companies: any env pair matching
//   PAPERCLIP_API_KEY_<SLUG> + PAPERCLIP_COMPANY_<SLUG>
// where SLUG is the first 8 hex chars of the company UUID (uppercased).
// Example for ff52ad91-250b-4d9d-a2ee-1d24b65ec3e8:
//   PAPERCLIP_API_KEY_FF52AD91=<lema-agent-key>
//   PAPERCLIP_COMPANY_FF52AD91=ff52ad91-250b-4d9d-a2ee-1d24b65ec3e8
export default function handler(req, res) {
  const ids = new Set();

  const primary = process.env.VITE_PAPERCLIP_COMPANY_ID || '';
  for (const id of primary.split(',').map(s => s.trim()).filter(Boolean)) {
    ids.add(id);
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (/^PAPERCLIP_COMPANY_[0-9A-F]{8}$/.test(key) && value) {
      const slug = key.replace('PAPERCLIP_COMPANY_', '');
      if (process.env[`PAPERCLIP_API_KEY_${slug}`]) {
        ids.add(value);
      }
    }
  }

  res.status(200).json({ companyIds: [...ids] });
}
