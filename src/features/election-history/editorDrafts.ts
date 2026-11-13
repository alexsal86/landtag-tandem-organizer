import { useCallback, useState } from 'react';
import { isRecord } from '@/utils/typeSafety';
import { safeGetItem } from '@/utils/storage';
import type { FormValues, HistoryEntity } from './model';

export interface ElectionEditorDraft {
  entity: HistoryEntity;
  id: string | null;
  periodId: string;
  values: FormValues;
}
const entities = new Set(['periods', 'people', 'districts', 'candidacies', 'mandates']);
const draftKey = (entity: HistoryEntity, id: string | null, periodId: string) => `${entity}:${id || 'new'}:${periodId}`;
function readDrafts(storageKey: string): Record<string, ElectionEditorDraft> {
  try {
    const raw: unknown = JSON.parse(safeGetItem(storageKey) || '{}');
    if (!isRecord(raw)) return {};
    const result: Record<string, ElectionEditorDraft> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!isRecord(value) || typeof value.entity !== 'string' || !entities.has(value.entity)
          || (value.id !== null && typeof value.id !== 'string') || typeof value.periodId !== 'string'
          || !isRecord(value.values) || !Object.values(value.values).every(v => typeof v === 'string' || typeof v === 'boolean')) continue;
      result[key] = value as unknown as ElectionEditorDraft;
    }
    return result;
  } catch { return {}; }
}

/** Partial forms stay private to the signed-in user's browser, never published. */
export function useElectionEditorDrafts(userId: string) {
  const storageKey = `election-editor-drafts:v1:${userId}`;
  const [drafts, setDrafts] = useState(() => readDrafts(storageKey));
  const [storageFailed, setStorageFailed] = useState(false);
  const persist = useCallback((next: Record<string, ElectionEditorDraft>) => {
    setDrafts(next);
    try {
      if (Object.keys(next).length) localStorage.setItem(storageKey, JSON.stringify(next));
      else localStorage.removeItem(storageKey);
      setStorageFailed(false);
    } catch { setStorageFailed(true); }
  }, [storageKey]);
  const put = (draft: ElectionEditorDraft) => persist({ ...readDrafts(storageKey), [draftKey(draft.entity, draft.id, draft.periodId)]: draft });
  const remove = (entity: HistoryEntity, id: string | null, periodId: string, expectedValues?: FormValues) => {
    const next = readDrafts(storageKey);
    const current = next[draftKey(entity, id, periodId)];
    if (expectedValues && current && JSON.stringify(current.values) !== JSON.stringify(expectedValues)) return;
    delete next[draftKey(entity, id, periodId)];
    persist(next);
  };
  const get = (entity: HistoryEntity, id: string | null, periodId: string) => drafts[draftKey(entity, id, periodId)];
  return { drafts: Object.values(drafts), get, put, remove, storageFailed };
}
