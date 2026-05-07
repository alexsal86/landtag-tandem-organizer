import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const OUTBOX_KEY = '@landtag/offline_outbox_v1';

export type OutboxItemKind = 'quick_note';

export interface OutboxItem {
  id: string; // local uuid
  kind: OutboxItemKind;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const randomId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const readAll = async (): Promise<OutboxItem[]> => {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = (items: OutboxItem[]) =>
  AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));

export const enqueue = async (
  kind: OutboxItemKind,
  payload: Record<string, unknown>,
): Promise<OutboxItem> => {
  const items = await readAll();
  const item: OutboxItem = {
    id: randomId(),
    kind,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  items.push(item);
  await writeAll(items);
  return item;
};

export const peekAll = (): Promise<OutboxItem[]> => readAll();

export const clearItem = async (id: string): Promise<void> => {
  const items = await readAll();
  await writeAll(items.filter((i) => i.id !== id));
};

const flushItem = async (item: OutboxItem): Promise<boolean> => {
  if (item.kind === 'quick_note') {
    const { error } = await supabase
      .from('quick_notes')
      .insert(item.payload as never);
    if (error) {
      item.attempts += 1;
      item.lastError = error.message;
      return false;
    }
    return true;
  }
  return false;
};

export interface FlushResult {
  flushed: number;
  failed: number;
  remaining: number;
}

export const flushOutbox = async (): Promise<FlushResult> => {
  const items = await readAll();
  if (items.length === 0) return { flushed: 0, failed: 0, remaining: 0 };

  let flushed = 0;
  let failed = 0;
  const remaining: OutboxItem[] = [];

  for (const item of items) {
    try {
      const ok = await flushItem(item);
      if (ok) {
        flushed += 1;
      } else {
        failed += 1;
        remaining.push(item);
      }
    } catch (e) {
      failed += 1;
      item.attempts += 1;
      item.lastError = e instanceof Error ? e.message : 'Unknown';
      remaining.push(item);
    }
  }

  await writeAll(remaining);
  return { flushed, failed, remaining: remaining.length };
};
