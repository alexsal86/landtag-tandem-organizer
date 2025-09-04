// Lightweight persistence + snapshots for Yjs collaboration.
// Aktuell: localStorage-basierter Stub. Für Produktion durch echte Backend-Calls ersetzen
// (z.B. Supabase Edge Function / REST API).
//
// Exportierte Funktionen:
// - encodeStateAsBase64 / decodeUpdateFromBase64
// - loadDocumentState / saveDocumentState
// - loadSnapshots / saveSnapshot
// - saveDocumentStateDebouncedFactory (debounced Voll-State-Save)
// - SnapshotMeta Typ

import * as Y from 'yjs';

const LS_DOC_PREFIX = 'yjs-doc:';
const LS_SNAPSHOT_PREFIX = 'yjs-snapshots:';

export interface SnapshotMeta {
  id: string;
  timestamp: number;
  updateBase64: string;
  note?: string;
}

function getDocKey(id: string) {
  return `${LS_DOC_PREFIX}${id}`;
}

function getSnapshotsKey(id: string) {
  return `${LS_SNAPSHOT_PREFIX}${id}`;
}

export function encodeStateAsBase64(doc: Y.Doc) {
  const update = Y.encodeStateAsUpdate(doc);
  return bufferToBase64(update);
}

export function decodeUpdateFromBase64(b64: string) {
  return new Uint8Array(base64ToBuffer(b64));
}

export function loadDocumentState(id: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(getDocKey(id));
}

export function saveDocumentState(id: string, updateBase64: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getDocKey(id), updateBase64);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to persist document', e);
  }
}

export function loadSnapshots(id: string): SnapshotMeta[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(getSnapshotsKey(id));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SnapshotMeta[];
  } catch {
    return [];
  }
}

export function saveSnapshot(id: string, updateBase64: string, note?: string): SnapshotMeta {
  const snapshot: SnapshotMeta = {
    id: generateId(),
    timestamp: Date.now(),
    updateBase64,
    note,
  };
  const existing = loadSnapshots(id);
  const updated = [snapshot, ...existing].slice(0, 30); // nur letzte 30 behalten
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getSnapshotsKey(id), JSON.stringify(updated));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to save snapshot', e);
  }
  return snapshot;
}

// Debounce-Fabrik für vollständiges Dokument-Speichern
export function saveDocumentStateDebouncedFactory(
  id: string,
  getEncoded: () => string | null,
  delay = 1000
) {
  let timer: any = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const encoded = getEncoded();
      if (encoded) saveDocumentState(id, encoded);
    }, delay);
  };
}

// Hilfsfunktionen

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function bufferToBase64(buf: Uint8Array) {
  if (typeof window === 'undefined') {
    return Buffer.from(buf).toString('base64');
  }
  let binary = '';
  const len = buf.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string) {
  if (typeof window === 'undefined') {
    return Buffer.from(b64, 'base64');
  }
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}