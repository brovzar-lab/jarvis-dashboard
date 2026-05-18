import { motion } from 'framer-motion';
import type { Agent, Issue } from '../types';

interface Props {
  agents: Agent[];
  activeIssues: Issue[];
  onToggleView?: () => void;
}

function getStatusClass(status?: string) {
  if (status === 'in_progress' || status === 'busy') return 'busy';
  if (status === 'active' || status === 'online') return 'active';
  return 'idle';
}

export function AgentGrid({ agents, activeIssues, onToggleView }: Props) {
  const taskMap = new Map<string, Issue>();
  for (const issue of activeIssues) {
    if (issue.assigneeAgentId) taskMap.set(issue.assigneeAgentId, issue);
  }

  const activeCount = agents.filter(a => getStatusClass(a.status) !== 'idle').length;

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest text-jarvis">AGENT STATUS</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-jarvis-dim">{activeCount}/{agents.length} ACTIVE</span>
          {onToggleView && (
            <button
              onClick={onToggleView}
              className="text-xs tracking-widest px-1.5 py-0.5 transition-colors"
              style={{ color: '#2a5f80', border: '1px solid #0a2a4a', borderRadius: 2, lineHeight: 1.4 }}
              title="Switch to behaviors view"
            >
              BEHAV
            </button>
          )}
        </div>
      </div>
      <div className="glow-line" />
      <div className="flex-1 overflow-y-auto space-y-2 mt-2">
        {agents.map((agent, i) => {
          const task = taskMap.get(agent.id) ?? (agent.currentTask ? { title: agent.currentTask, identifier: agent.currentTaskId ?? '' } as Issue : null);
          const statusClass = getStatusClass(agent.status);

          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2 py-1.5 border-b border-opacity-20"
              style={{ borderColor: '#0a2a4a' }}
            >
              <span className={`status-dot ${statusClass} mt-1.5`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: statusClass === 'idle' ? '#2a5f80' : '#7ecfff' }}>
                  {agent.name}
                </div>
                {task ? (
                  <div className="text-xs truncate mt-0.5" style={{ color: '#1a4060' }}>
                    {task.identifier && <span style={{ color: '#00d4ff', opacity: 0.6 }}>{task.identifier} · </span>}
                    {task.title}
                  </div>
                ) : (
                  <div className="text-xs mt-0.5" style={{ color: '#142030' }}>IDLE</div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
