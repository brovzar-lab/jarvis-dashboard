import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  timestamp: number;
}

const STORAGE_KEY = 'jarvis_todos';

function loadTodos(): TodoItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as TodoItem[];
  } catch {}
  return [];
}

export function TodoPanel() {
  const [todos, setTodos] = useState<TodoItem[]>(loadTodos);
  const [input, setInput] = useState('');
  const [exported, setExported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  const addTodo = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setTodos(prev => [{ id: String(Date.now()), text, done: false, timestamp: Date.now() }, ...prev]);
    setInput('');
    inputRef.current?.focus();
  }, [input]);

  const toggleTodo = useCallback((id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearDone = useCallback(() => {
    setTodos(prev => prev.filter(t => !t.done));
  }, []);

  const exportNotes = useCallback(async () => {
    const pending = todos.filter(t => !t.done);
    if (pending.length === 0) return;
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const body = pending.map(t => `• ${t.text}`).join('\n');
    const full = `JARVIS NOTES — ${dateStr}\n\n${body}`;

    // iOS/Android: Web Share API shows native sheet including Apple Notes
    if (navigator.share) {
      try {
        await navigator.share({ title: 'JARVIS Notes', text: full });
        return;
      } catch { /* cancelled */ }
    }

    // Desktop: copy to clipboard
    try {
      await navigator.clipboard.writeText(full);
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch {
      // Last resort: open Notes on iOS via URL scheme
      window.location.href = `notes://x-callback-url/create?title=JARVIS%20Notes&body=${encodeURIComponent(body)}`;
    }
  }, [todos]);

  const pendingCount = todos.filter(t => !t.done).length;
  const doneCount = todos.filter(t => t.done).length;

  return (
    <div className="panel-border corner-decoration rounded p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest text-jarvis">NOTES</span>
          {pendingCount > 0 && (
            <span className="tracking-widest" style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', fontSize: '0.48rem', padding: '1px 5px', borderRadius: 2 }}>
              {pendingCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {doneCount > 0 && (
            <button
              onClick={clearDone}
              className="tracking-widest transition-opacity hover:opacity-80"
              style={{ color: '#1a4060', border: '1px solid rgba(0,212,255,0.1)', fontSize: '0.48rem', padding: '1px 5px', borderRadius: 2, background: 'transparent' }}
            >
              CLEAR DONE
            </button>
          )}
          {pendingCount > 0 && (
            <button
              onClick={exportNotes}
              className="tracking-widest transition-opacity hover:opacity-80"
              style={{ color: exported ? '#34d399' : '#00d4ff', border: `1px solid ${exported ? 'rgba(52,211,153,0.4)' : 'rgba(0,212,255,0.25)'}`, fontSize: '0.48rem', padding: '1px 5px', borderRadius: 2, background: 'transparent' }}
            >
              {exported ? '✓ COPIED' : 'EXPORT'}
            </button>
          )}
        </div>
      </div>
      <div className="glow-line" />

      {/* Input row */}
      <div className="flex items-center gap-2 mt-2 mb-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
          placeholder="Type a note and press Enter..."
          className="flex-1 min-w-0 bg-transparent outline-none"
          style={{
            color: '#7ecfff',
            borderBottom: '1px solid rgba(0,212,255,0.18)',
            fontSize: '0.72rem',
            padding: '3px 2px',
          }}
        />
        <button
          onClick={addTodo}
          className="flex-shrink-0 tracking-widest transition-opacity hover:opacity-80"
          style={{ color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)', fontSize: '0.48rem', padding: '2px 7px', borderRadius: 2, background: 'transparent' }}
        >
          ADD
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pt-1">
        {todos.length === 0 ? (
          <motion.div
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="tracking-widest py-2"
            style={{ color: '#1a3040', fontSize: '0.6rem' }}
          >
            NO NOTES YET
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {todos.map(todo => (
              <motion.div
                key={todo.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-start gap-2"
                style={{ padding: '5px 2px', borderBottom: '1px solid rgba(0,212,255,0.04)' }}
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className="flex-shrink-0 mt-0.5 transition-colors"
                  style={{
                    width: 13, height: 13, borderRadius: 2, flexShrink: 0,
                    border: `1px solid ${todo.done ? 'rgba(0,212,255,0.6)' : 'rgba(0,212,255,0.25)'}`,
                    background: todo.done ? 'rgba(0,212,255,0.15)' : 'transparent',
                    color: '#00d4ff', fontSize: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {todo.done ? '✓' : ''}
                </button>
                <span
                  className="flex-1 min-w-0 leading-snug"
                  style={{
                    color: todo.done ? '#1a3a50' : '#a8d8f0',
                    fontSize: '0.75rem',
                    textDecoration: todo.done ? 'line-through' : 'none',
                    wordBreak: 'break-word',
                  }}
                >
                  {todo.text}
                </span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="flex-shrink-0 transition-opacity opacity-20 hover:opacity-60"
                  style={{ color: '#00d4ff', fontSize: '0.75rem', lineHeight: 1, padding: '0 2px' }}
                >
                  ×
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
