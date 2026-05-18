import { motion } from 'framer-motion';
import type { Agent, Issue } from '../types';

interface Props {
  agents: Agent[];
  activeIssues: Issue[];
  companyLabels: Record<string, string>;
  onToggleView?: () => void;
}

function getStatusClass(status?: string) {
  if (status === 'in_progress' || status === 'busy') return 'busy';
  if (status === 'active' || status === 'online') return 'active';
  return 'idle';
}

function inferTags(agent: Agent, task?: Issue): string[] {
  const name = agent.name.toLowerCase();
  const taskTitle = (task?.title ?? '').toLowerCase();
  const caps = (agent.capabilities ?? '').toLowerCase();
  const tags: string[] = [];

  // Role-based
  if (agent.role === 'ceo') tags.push('Executive');
  else if (agent.role === 'cto') tags.push('Infra');
  else if (agent.role === 'cmo') tags.push('Marketing');
  else if (agent.role === 'pm') tags.push('Product');
  else if (agent.role === 'designer') tags.push('Design');
  else if (agent.role === 'qa') tags.push('QA');

  // Name / capabilities keywords
  const combined = name + ' ' + caps;
  if (combined.includes('web') || combined.includes('react') || combined.includes('vite')) tags.push('Web');
  if (combined.includes('ios') || combined.includes('swift')) tags.push('iOS');
  if (combined.includes('android') || combined.includes('kotlin')) tags.push('Android');
  if (combined.includes('mobile') && !tags.includes('iOS') && !tags.includes('Android')) tags.push('Mobile');
  if (combined.includes('debug')) tags.push('Debug');
  if (combined.includes('firebase')) tags.push('Firebase');
  if (combined.includes('architect')) tags.push('Arch');

  // Task title — add up to 1 contextual tag
  if (taskTitle.includes('auth')) tags.push('Auth');
  else if (taskTitle.includes('pitch') || taskTitle.includes('investor')) tags.push('Fundraising');
  else if (taskTitle.includes('deploy') || taskTitle.includes('ci/cd')) tags.push('DevOps');
  else if (taskTitle.includes('api') || taskTitle.includes('integration')) tags.push('API');
  else if (taskTitle.includes('migration') || taskTitle.includes('schema')) tags.push('Migration');

  return [...new Set(tags)].slice(0, 3);
}

// APPU = cyan (#00d4ff), LEMA = violet (#a78bfa), unknown = dim
function companyColor(label?: string): { bg: string; text: string; border: string } {
  if (label === 'APPU') return { bg: 'rgba(0,212,255,0.12)', text: '#00d4ff', border: 'rgba(0,212,255,0.3)' };
  if (label === 'LEMA') return { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa', border: 'rgba(167,139,250,0.3)' };
  return { bg: 'rgba(42,95,128,0.2)', text: '#2a5f80', border: 'rgba(42,95,128,0.3)' };
}

function tagColor(tag: string): { bg: string; text: string } {
  const warm = ['Fundraising', 'Executive', 'Marketing'];
  const green = ['QA', 'Debug', 'DevOps'];
  const violet = ['Infra', 'Arch', 'API', 'Firebase'];
  if (warm.includes(tag)) return { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24' };
  if (green.includes(tag)) return { bg: 'rgba(52,211,153,0.1)', text: '#34d399' };
  if (violet.includes(tag)) return { bg: 'rgba(167,139,250,0.1)', text: '#a78bfa' };
  return { bg: 'rgba(0,212,255,0.08)', text: '#7ecfff' };
}

export function AgentBehaviorsPanel({ agents, activeIssues, companyLabels, onToggleView }: Props) {
  const taskMap = new Map<string, Issue>();
  for (const issue of activeIssues) {
    if (issue.assigneeAgentId) taskMap.set(issue.assigneeAgentId, issue);
  }

  const activeCount = agents.filter(a => getStatusClass(a.status) !== 'idle').length;

  // Group by company
  const byCompany = new Map<string, Agent[]>();
  for (const agent of agents) {
    const cid = agent.companyId ?? '__unknown__';
    if (!byCompany.has(cid)) byCompany.set(cid, []);
    byCompany.get(cid)!.push(agent);
  }

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-jarvis">AGENT BEHAVIORS</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-jarvis-dim">{activeCount}/{agents.length} ACTIVE</span>
          {onToggleView && (
            <button
              onClick={onToggleView}
              className="text-xs tracking-widest px-1.5 py-0.5 transition-colors"
              style={{ color: '#2a5f80', border: '1px solid #0a2a4a', borderRadius: 2, lineHeight: 1.4 }}
              title="Switch to grid view"
            >
              GRID
            </button>
          )}
        </div>
      </div>
      <div className="glow-line" />
      <div className="flex-1 overflow-y-auto mt-2 space-y-4">
        {[...byCompany.entries()].map(([cid, compAgents]) => {
          const label = companyLabels[cid];
          const colors = companyColor(label);
          return (
            <div key={cid}>
              {label && (
                <div
                  className="text-xs tracking-widest mb-2 px-1.5 py-0.5 inline-block"
                  style={{ color: colors.text, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 2 }}
                >
                  {label}
                </div>
              )}
              <div className="space-y-1.5">
                {compAgents.map((agent, i) => {
                  const task = taskMap.get(agent.id) ?? (agent.currentTask ? { title: agent.currentTask, identifier: agent.currentTaskId ?? '', id: '', status: 'in_progress', priority: 'medium', updatedAt: '' } as Issue : undefined);
                  const statusClass = getStatusClass(agent.status);
                  const tags = inferTags(agent, task);

                  return (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="py-1.5 border-b"
                      style={{ borderColor: '#0a2a4a' }}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`status-dot ${statusClass}`} style={{ flexShrink: 0 }} />
                        <span
                          className="text-xs font-medium truncate flex-1 min-w-0"
                          style={{ color: statusClass === 'idle' ? '#2a5f80' : '#7ecfff' }}
                        >
                          {agent.name}
                        </span>
                      </div>
                      {task ? (
                        <div className="text-xs truncate mb-1 pl-3.5" style={{ color: '#1a4060' }}>
                          {task.identifier && (
                            <span style={{ color: colors.text, opacity: 0.7 }}>{task.identifier} · </span>
                          )}
                          {task.title}
                        </div>
                      ) : (
                        <div className="text-xs mb-1 pl-3.5" style={{ color: '#0d2030' }}>IDLE</div>
                      )}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-3.5">
                          {tags.map(tag => {
                            const tc = tagColor(tag);
                            return (
                              <span
                                key={tag}
                                className="text-xs px-1 leading-tight"
                                style={{ color: tc.text, background: tc.bg, borderRadius: 2, fontSize: '0.6rem', letterSpacing: '0.05em' }}
                              >
                                {tag}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
