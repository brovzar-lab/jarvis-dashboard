export interface JarvisCommand {
  command: true;
  action: 'patch_issue' | 'create_issue' | 'add_comment' | 'get_issue' | 'trigger_heartbeat';
  params: Record<string, unknown>;
  confirmation: string;
  reply: string;
}

export function parseCommandResponse(text: string): JarvisCommand | null {
  const trimmed = text.trim();
  // Must start with { to avoid expensive JSON.parse on normal text
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.command === true && parsed.action && parsed.confirmation) {
      return parsed as JarvisCommand;
    }
  } catch {
    // Not JSON — normal text response
  }
  return null;
}

export async function executeCommand(
  cmd: JarvisCommand,
  companyId: string
): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    const res = await fetch('/api/paperclip-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: cmd.action, params: cmd.params, companyId }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: `Action failed: ${data.error ?? res.status}` };
    }
    return { success: true, message: cmd.reply || 'Done, sir.', data };
  } catch (err) {
    return { success: false, message: `Network error: ${String(err)}` };
  }
}
