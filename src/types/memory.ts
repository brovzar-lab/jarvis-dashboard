export type MemoryScope = 'global' | 'session';

export type MemoryType = 'fact' | 'experience' | 'preference' | 'observation';

export type MemorySource = 'agent_chat' | 'user_correction' | 'briefing' | 'manual';

export interface Memory {
  id: string;
  scope: MemoryScope;

  type: MemoryType;
  content: string;
  source: MemorySource;

  entities: string[];
  categories: string[];
  keywords: string[];

  confidence: number;
  timesRecalled: number;
  timesConfirmed: number;
  timesContradicted: number;
  lastRecalledAt?: string;

  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface QueryContext {
  contentText?: string;
  categories?: string[];
  entities?: string[];
  keywords?: string[];
}

export interface ScoredMemory {
  memory: Memory;
  score: number;
}

export interface ExtractedMemory {
  scope: MemoryScope;
  type: MemoryType;
  content: string;
  entities: string[];
  categories: string[];
  keywords: string[];
}

export const DEFAULT_CONFIDENCE = 0.7;
export const ARCHIVE_THRESHOLD = 0.2;
export const MAX_RECALL_MEMORIES = 15;
export const DECAY_RATE_PER_DAY = 0.005;
export const DEDUP_THRESHOLD = 0.65;
export const MIN_DAYS_BEFORE_DECAY = 30;
