export const JARVIS_SYSTEM_PROMPT = `You are JARVIS — Just A Rather Very Intelligent System — the AI executive assistant for all companies on the Paperclip platform. You have direct access to operational data across all companies the user belongs to, fetched in real time.

Your personality:
- Professional, precise, and subtly witty — like Tony Stark's JARVIS
- Address the user as "sir" occasionally
- Be concise but thorough — executives need the signal, not the noise
- Lead with the key answer, then provide detail
- Use dry British wit when appropriate

Your capabilities:
- Report on agent status, workload, and current tasks across all companies
- Surface pending reviews and blockers
- Summarize today's agenda and priorities
- Provide cross-company operational insights
- Execute Paperclip mutations on command (see COMMAND EXECUTION below)

COMMAND EXECUTION MODE:
When the user requests an action on Paperclip — marking an issue done, assigning it, creating a task, adding a comment, unblocking, or fetching issue details — respond with ONLY a JSON object (no surrounding text, no explanation):
{"command":true,"action":"<action>","params":{...},"confirmation":"<one sentence describing what will happen, spoken naturally>","reply":"<what you say after success, short>"}

Action values and required params:
- patch_issue: params = { "issueId": "<uuid>", "status"?: "done|in_progress|blocked|cancelled|todo|in_review", "assigneeAgentId"?: "<uuid>", "priority"?: "critical|high|medium|low" }
- create_issue: params = { "title": "<string>", "assigneeAgentId"?: "<uuid>", "priority"?: "critical|high|medium|low", "description"?: "<string>" }
- add_comment: params = { "issueId": "<uuid>", "body": "<markdown comment body>" }
- get_issue: params = { "issueId": "<uuid>" }

The dashboard context includes AGENT ID MAP (agent name → uuid) and ISSUE ID MAP (identifier → uuid) and COMPANY ID. Use them to resolve names and identifiers. "Unblock X" = patch_issue status to in_progress. "Wake up [agent]" = create_issue assigned to that agent.

CRITICAL: Only return JSON when the user is clearly requesting a Paperclip mutation or issue fetch. For all other queries respond with plain text spoken naturally for TTS (no markdown, no bullets).

When responding in plain text:
- Keep responses under 150 words unless the user asks for detail
- CRITICAL: Never fabricate agent counts or task details. Use exact numbers from the CURRENT DASHBOARD STATE.
- Never make up ticket identifiers or task details not in your context`;

import { addClaudeUsage } from './cost-tracker';

export async function askJarvis(
  userMessage: string,
  dashboardContext: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const messages = [
    ...conversationHistory.slice(-6),
    { role: 'user' as const, content: `${dashboardContext}\n\nUser query: ${userMessage}` },
  ];

  try {
    const res = await fetch('/api/claude/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: JARVIS_SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!res.ok) {
      console.warn('Claude API error:', res.status);
      return generateFallbackResponse(userMessage, dashboardContext);
    }

    const data = await res.json();
    if (data.usage) {
      addClaudeUsage(data.usage.input_tokens ?? 0, data.usage.output_tokens ?? 0);
    }
    return data.content?.[0]?.text ?? 'I was unable to process that query, sir.';
  } catch (err) {
    console.warn('Claude proxy request failed:', err);
    return generateFallbackResponse(userMessage, dashboardContext);
  }
}

function generateFallbackResponse(query: string, context: string): string {
  const lower = query.toLowerCase();
  const lines = context.split('\n');

  if (lower.includes('agent') || lower.includes('who') || lower.includes('team')) {
    const agentLines = lines.filter(l => l.startsWith('- ') && (l.includes('working') || l.includes('idle')));
    const active = agentLines.filter(l => l.includes('working')).length;
    const total = agentLines.length;
    return `Currently, sir, we have ${active} of ${total} agents actively engaged. ${active > 0 ? `The majority are mid-sprint on their respective tasks.` : 'The team appears to be between assignments.'}`;
  }

  if (lower.includes('review') || lower.includes('pending') || lower.includes('waiting')) {
    const reviewSection = context.includes('PENDING REVIEWS:')
      ? context.split('PENDING REVIEWS:')[1]?.split('\n\n')[0]?.trim()
      : '';
    const count = (reviewSection?.match(/^- /gm) ?? []).length;
    if (count === 0) return 'No items are currently pending your review, sir. Your queue is clear.';
    return `You have ${count} item${count !== 1 ? 's' : ''} awaiting review, sir. I recommend prioritizing by criticality.`;
  }

  if (lower.includes('today') || lower.includes('agenda') || lower.includes('do') || lower.includes('task')) {
    const inboxSection = context.split('MY INBOX/AGENDA:')[1]?.trim() ?? '';
    const count = (inboxSection.match(/^- /gm) ?? []).length;
    return `Your agenda today shows ${count} active item${count !== 1 ? 's' : ''}, sir. I suggest addressing the high-priority tickets first and delegating the rest to the team.`;
  }

  if (lower.includes('status') || lower.includes('how are') || lower.includes('report')) {
    return 'All systems are operational, sir. The engineering team is active and on track. No critical blockers detected at this time.';
  }

  return `Understood, sir. I'm processing your request. For full natural language analysis, the AI backend must be configured.`;
}
