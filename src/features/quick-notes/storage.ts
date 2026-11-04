import type { QuickNote } from "./types";

export type NoteScope = { userId: string; tenantId: string };
export const scopeKey = ({ userId, tenantId }: NoteScope) => `${userId}:${tenantId}`;
export type NoteWrite = {
  id: string;
  scope: string;
  noteId: string;
  kind: "create" | "edit";
  title: string | null;
  content: string;
  color?: string | null;
  isPinned?: boolean;
  baseRevision?: number;
  dependsOn?: string;
  createdAt: string;
  status: "pending" | "conflict" | "error";
  error?: string;
};

let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("landtagsos-quick-notes", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("snapshots");
        const outbox = request.result.createObjectStore("outbox", { keyPath: "id" });
        outbox.createIndex("scope", "scope");
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); database = undefined; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Lokaler Notizspeicher wird von einem anderen Fenster blockiert"));
    }).catch(error => { database = undefined; throw error; });
  }
  return database;
}

async function transaction<T>(store: "snapshots" | "outbox", mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    // Resolve only after commit: clearing an editor before this loses offline data.
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? new Error("Lokales Speichern abgebrochen"));
  });
}
export const noteStorage = {
  async readSnapshot(scope: string): Promise<QuickNote[] | undefined> {
    return transaction("snapshots", "readonly", store => store.get(scope));
  },
  async writeSnapshot(scope: string, notes: QuickNote[]) {
    await transaction("snapshots", "readwrite", store => store.put(notes, scope));
  },
  async removeSnapshot(scope: string) {
    await transaction("snapshots", "readwrite", store => store.delete(scope));
  },
  async writes(scope: string): Promise<NoteWrite[]> {
    const writes = await transaction<NoteWrite[]>("outbox", "readonly", store => store.index("scope").getAll(scope));
    const ordered: NoteWrite[] = [];
    const seen = new Set<string>();
    const byId = new Map(writes.map(write => [write.id, write]));
    const visit = (write: NoteWrite) => {
      if (seen.has(write.id)) return;
      seen.add(write.id);
      const predecessor = write.dependsOn ? byId.get(write.dependsOn) : undefined;
      if (predecessor) visit(predecessor);
      ordered.push(write);
    };
    writes.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).forEach(visit);
    return ordered;
  },
  async putWrite(write: NoteWrite) {
    await transaction("outbox", "readwrite", store => store.put(write));
  },
  async completeWrite(write: NoteWrite, revision: number) {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("outbox", "readwrite");
      const store = tx.objectStore("outbox");
      const request = store.index("scope").getAll(write.scope);
      request.onsuccess = () => {
        for (const successor of request.result as NoteWrite[]) {
          if (successor.dependsOn === write.id) store.put({ ...successor, dependsOn: undefined, baseRevision: revision });
        }
        store.delete(write.id);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Synchronisierung konnte nicht lokal bestätigt werden"));
    });
  },
  async deleteWrite(id: string) {
    await transaction("outbox", "readwrite", store => store.delete(id));
  },
};
