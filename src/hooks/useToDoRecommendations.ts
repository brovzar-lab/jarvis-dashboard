import { useState, useEffect, useCallback, useRef } from 'react';
import type { Email, CalendarEvent, ObsidianNote } from '../services/integrations';

export interface TodoRecommendation {
  id: string;
  text: string;
  source: 'email' | 'calendar' | 'obsidian';
  priority: 'high' | 'medium' | 'low';
  generatedAt: number;
}

const STORAGE_KEY = 'jarvis_todo_recs';
const DISMISSED_KEY = 'jarvis_todo_recs_dismissed';
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

function loadStored(): TodoRecommendation[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as TodoRecommendation[];
  } catch {}
  return [];
}

function loadDismissed(): Set<string> {
  try {
    const saved = localStorage.getItem(DISMISSED_KEY);
    if (saved) return new Set(JSON.parse(saved) as string[]);
  } catch {}
  return new Set();
}

interface UseToDoRecommendationsOptions {
  emails: Email[];
  calendarEvents: CalendarEvent[];
  obsidianNotes: ObsidianNote[];
  enabled: boolean;
}

export interface UseToDoRecommendationsResult {
  recommendations: TodoRecommendation[];
  isGenerating: boolean;
  lastGenerated: number | null;
  refresh: () => void;
  dismiss: (id: string) => void;
}

export function useToDoRecommendations({
  emails,
  calendarEvents,
  obsidianNotes,
  enabled,
}: UseToDoRecommendationsOptions): UseToDoRecommendationsResult {
  const [recommendations, setRecommendations] = useState<TodoRecommendation[]>(() => {
    const stored = loadStored();
    const dismissed = loadDismissed();
    return stored.filter(r => !dismissed.has(r.id));
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<number | null>(() => {
    const stored = loadStored();
    return stored.length > 0 ? stored[0].generatedAt : null;
  });
  const isGeneratingRef = useRef(false);
  const hasRunRef = useRef(false);

  const generateFn = useCallback(async () => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/todos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, calendarEvents, obsidianNotes }),
      });
      if (!res.ok) return;
      const data = await res.json() as {
        todos: Array<{ text: string; source: 'email' | 'calendar' | 'obsidian'; priority: 'high' | 'medium' | 'low' }>;
      };
      if (Array.isArray(data.todos) && data.todos.length > 0) {
        const now = Date.now();
        const newRecs: TodoRecommendation[] = data.todos.map((t, i) => ({
          id: `rec-${now}-${i}`,
          text: t.text,
          source: t.source,
          priority: t.priority,
          generatedAt: now,
        }));
        setRecommendations(newRecs);
        setLastGenerated(now);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecs)); } catch {}
        // Clear dismissed set on fresh generation
        try { localStorage.removeItem(DISMISSED_KEY); } catch {}
      }
    } catch {
      // Network error — silently degrade
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  }, [emails, calendarEvents, obsidianNotes]);

  // Keep a stable ref so the interval always calls the latest version
  const generateRef = useRef(generateFn);
  generateRef.current = generateFn;

  // Generate once when data first loads
  useEffect(() => {
    if (!enabled) return;
    if (hasRunRef.current) return;
    if (emails.length === 0 && calendarEvents.length === 0 && obsidianNotes.length === 0) return;
    hasRunRef.current = true;
    generateRef.current();
  }, [enabled, emails.length, calendarEvents.length, obsidianNotes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic refresh
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => generateRef.current(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled]);

  const dismiss = useCallback((id: string) => {
    setRecommendations(prev => {
      const updated = prev.filter(r => r.id !== id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      // Track dismissed IDs across refreshes
      const dismissed = loadDismissed();
      dismissed.add(id);
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed])); } catch {}
      return updated;
    });
  }, []);

  return {
    recommendations,
    isGenerating,
    lastGenerated,
    refresh: useCallback(() => generateRef.current(), []),
    dismiss,
  };
}
