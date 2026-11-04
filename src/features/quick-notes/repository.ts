import { toggleChecklistItem } from "./checklists";
import { QueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/utils/errorHandler";
import { fetchNotes, isNetworkError, parseNote, sendWrite } from "./api";
import { noteStorage, scopeKey, type NoteScope, type NoteWrite } from "./storage";
import type { QuickNote } from "./types";

export const notesKey = (scope: NoteScope) => ["quick-notes", scope.userId, scope.tenantId] as const;
export type NotePatch = Database["public"]["Tables"]["quick_notes"]["Update"];
export type SyncState = { writes: NoteWrite[]; online: boolean; syncing: boolean; error: string | null };
export function overlayWrites(notes: QuickNote[], writes: NoteWrite[], scope: NoteScope): QuickNote[] {
  const result = new Map(notes.map(note => [note.id, note]));
  for (const write of writes) {
    if (write.scope !== scopeKey(scope)) continue;
    const old = result.get(write.noteId);
    // Keep revoked/deleted shared notes out of the list; the pending operation
    // remains visible in the outbox so its local text can be rescued.
    if (!old && write.kind !== "create") continue;
    const failure = writes.find(other => other.noteId === write.noteId && other.status !== "pending");
    result.set(write.noteId, {
      id: write.noteId, color: write.color ?? null,
      is_pinned: write.isPinned ?? false, created_at: write.createdAt, updated_at: write.createdAt,
      user_id: scope.userId, tenant_id: scope.tenantId, revision: 0,
      ...old, title: write.title, content: write.content,
      sync_status: failure?.status ?? write.status, sync_error: failure?.error ?? write.error,
    });
  }
  return [...result.values()];
}

export class QuickNotesRepository {
  readonly key;
  private scopeId;
  private listeners = new Set<() => void>();
  private state: SyncState = { writes: [], online: navigator.onLine, syncing: false, error: null };
  private running: Promise<void> | null = null;
  private refs = 0;
  private stop?: () => void;
  private broadcast?: BroadcastChannel;
  private ownRevisions = new Map<string, Map<number, number>>();
  private checklistQueue = new Map<string, Promise<unknown>>();
  private patchQueue = new Map<string, Promise<unknown>>();
  constructor(readonly scope: NoteScope, private client: QueryClient) {
    this.key = notesKey(scope);
    this.scopeId = scopeKey(scope);
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private emit(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  getNotes = () => this.client.getQueryData<QuickNote[]>(this.key) ?? [];
  setNotes = (update: QuickNote[] | ((notes: QuickNote[]) => QuickNote[])) => {
    this.client.setQueryData<QuickNote[]>(this.key, old => typeof update === "function" ? update(old ?? []) : update);
  };
  private async persist() {
    try { await noteStorage.writeSnapshot(this.scopeId, this.getNotes()); }
    catch (error) { this.emit({ error: `Notiz-Cache nicht verfügbar: ${getErrorMessage(error)}` }); }
  }
  private async refreshWrites() {
    const writes = await noteStorage.writes(this.scopeId);
    this.emit({ writes });
    return writes;
  }
  async read(signal?: AbortSignal) {
    if (!navigator.onLine) {
      const cached = await noteStorage.readSnapshot(this.scopeId);
      const writes = await this.refreshWrites();
      return overlayWrites(cached ?? [], writes, this.scope);
    }
    try {
      const notes = await fetchNotes(this.scope.tenantId, undefined, signal);
      let writes: NoteWrite[] = [];
      try { writes = await this.refreshWrites(); } catch (error) { this.emit({ error: getErrorMessage(error) }); }
      const existing = this.getNotes();
      const result = overlayWrites(notes.map(note => {
        const cached = existing.find(old => old.id === note.id);
        return cached && (cached.revision ?? 0) > (note.revision ?? 0) ? cached : note;
      }), writes, this.scope);
      this.emit({ error: null });
      await noteStorage.writeSnapshot(this.scopeId, result).catch(error => this.emit({ error: getErrorMessage(error) }));
      return result;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!isNetworkError(error)) {
        this.setNotes([]);
        await noteStorage.removeSnapshot(this.scopeId).catch(() => {});
        throw error;
      }
      const cached = await noteStorage.readSnapshot(this.scopeId);
      this.emit({ error: "Verbindung unterbrochen. Angezeigt werden lokal gespeicherte Notizen." });
      return overlayWrites(cached ?? [], await this.refreshWrites(), this.scope);
    }
  }
  async removeCachedNote(id: string) {
    this.setNotes(notes => notes.filter(note => note.id !== id));
    await this.persist();
  }
  async refreshNote(id: string) {
    if (!navigator.onLine) return;
    const notes = await fetchNotes(this.scope.tenantId, id);
    const writes = await this.refreshWrites().catch(() => this.state.writes);
    this.setNotes(old => overlayWrites([...old.filter(n => n.id !== id), ...notes.map(note => {
      const cached = old.find(item => item.id === id);
      return cached && (cached.revision ?? 0) > (note.revision ?? 0) ? cached : note;
    })], writes, this.scope));
    await this.persist();
  }
  async queue(input: { note?: QuickNote; title: string | null; content: string; color?: string | null; isPinned?: boolean }) {
    if (input.note?.tenant_id && input.note.tenant_id !== this.scope.tenantId) throw new Error("Notiz gehört zu einem anderen Arbeitsbereich");
    await this.client.cancelQueries({ queryKey: this.key });
    const writes = await this.refreshWrites();
    const noteId = input.note?.id ?? crypto.randomUUID();
    const predecessors = writes.filter(write => write.noteId === noteId);
    if (predecessors.some(write => write.status !== "pending")) throw new Error("Bitte zuerst den Synchronisierungskonflikt dieser Notiz lösen");
    const predecessor = predecessors[predecessors.length - 1];
    let baseRevision = input.note?.revision;
    const lineage = this.ownRevisions.get(noteId);
    const seenRevisions = new Set<number>();
    while (baseRevision !== undefined && lineage?.has(baseRevision) && !seenRevisions.has(baseRevision)) {
      seenRevisions.add(baseRevision); baseRevision = lineage.get(baseRevision);
    }
    const write: NoteWrite = {
      id: crypto.randomUUID(), scope: this.scopeId, noteId,
      kind: input.note ? "edit" : "create", title: input.title, content: input.content,
      color: input.color, isPinned: input.isPinned,
      baseRevision: predecessor ? undefined : baseRevision,
      dependsOn: predecessor?.id, createdAt: new Date().toISOString(), status: "pending",
    };
    // IDB commit must succeed before the caller is allowed to clear its draft.
    await noteStorage.putWrite(write);
    const pending = await this.refreshWrites();
    this.setNotes(old => overlayWrites(old, pending, this.scope));
    await this.persist();
    this.announce();
    void this.sync();
    return { id: noteId };
  }
  sync = () => {
    if (this.running) return this.running;
    const work = async () => {
      if (!navigator.onLine) { this.emit({ online: false }); return; }
      this.emit({ syncing: true, online: true });
      try {
        let progress = true;
        while (progress && navigator.onLine) {
          progress = false;
          const writes = await this.refreshWrites();
          for (const write of writes) {
            if (write.status !== "pending" || write.dependsOn || writes.some(other => other.noteId === write.noteId && other.status !== "pending")) continue;
            try {
              const saved = await sendWrite(this.scope, write);
              await noteStorage.completeWrite(write, saved.revision ?? 0);
              if (write.baseRevision !== undefined && saved.revision !== undefined && saved.revision !== write.baseRevision) {
                const lineage = this.ownRevisions.get(write.noteId) ?? new Map<number, number>();
                lineage.set(write.baseRevision, saved.revision);
                this.ownRevisions.set(write.noteId, lineage);
              }
              const pending = await this.refreshWrites();
              this.setNotes(old => overlayWrites([
                ...old.filter(n => n.id !== saved.id),
                { ...old.find(n => n.id === saved.id), ...saved, sync_status: undefined, sync_error: undefined },
              ], pending, this.scope));
              await this.persist();
              progress = true;
              this.emit({ error: null });
              this.announce();
            } catch (error) {
              if (isNetworkError(error)) { this.emit({ error: "Synchronisierung wartet auf eine Verbindung" }); return; }
              const message = getErrorMessage(error);
              const failed: NoteWrite = { ...write, status: /NOTE_CONFLICT|inzwischen geändert/i.test(message) ? "conflict" : "error", error: message };
              await noteStorage.putWrite(failed);
              const pending = await this.refreshWrites();
              this.setNotes(old => overlayWrites(old, pending, this.scope));
              this.emit({ error: message });
            }
          }
        }
      } catch (error) { this.emit({ error: `Lokale Warteschlange nicht verfügbar: ${getErrorMessage(error)}` }); }
      finally { this.emit({ syncing: false }); }
    };
    // Web Locks serialize tabs. The operation receipt also makes transport retries
    // safe on browsers without Web Locks and after a crash during acknowledgement.
    this.running = (navigator.locks ? navigator.locks.request(`quick-notes:${this.scopeId}`, work).then(() => undefined) : work())
      .finally(() => { this.running = null; });
    return this.running;
  };
  async retry(write: NoteWrite) {
    if (write.scope !== this.scopeId || write.status === "conflict") return;
    await noteStorage.putWrite({ ...write, status: "pending", error: undefined });
    await this.refreshWrites();
    await this.sync();
  }
  async rescue(write: NoteWrite) {
    if (write.scope !== this.scopeId) return;
    const related = (await this.refreshWrites()).filter(item => item.noteId === write.noteId);
    const latest = related[related.length - 1] ?? write;
    await this.queue({ title: latest.title, content: latest.content, color: latest.color });
    // The recovered copy is durably queued before removing any failed edit.
    for (const item of related) await noteStorage.deleteWrite(item.id);
    await this.refreshWrites();
    if (navigator.onLine) await this.refreshNote(write.noteId);
    else await this.removeCachedNote(write.noteId);
  }
  toggleChecklist(noteId: string, index: number) {
    const previous = this.checklistQueue.get(noteId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const note = this.getNotes().find(item => item.id === noteId);
      if (!note) throw new Error("Notiz nicht gefunden");
      return this.queue({ note, title: note.title, content: toggleChecklistItem(note.content, index) });
    });
    this.checklistQueue.set(noteId, next);
    void next.finally(() => { if (this.checklistQueue.get(noteId) === next) this.checklistQueue.delete(noteId); }).catch(() => {});
    return next;
  }
  patch(noteId: string, patch: NotePatch) {
    const previous = this.patchQueue.get(noteId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      if (!navigator.onLine) throw new Error("Diese Aktion benötigt eine Verbindung. Dein Text bleibt lokal gespeichert.");
      if ((await this.refreshWrites()).some(write => write.noteId === noteId)) throw new Error("Bitte die Synchronisierung dieser Notiz abwarten");
      await this.client.cancelQueries({ queryKey: this.key });
      const before = this.getNotes().find(note => note.id === noteId);
      if (!before) throw new Error("Notiz nicht gefunden");
      this.setNotes(old => patch.is_archived || patch.deleted_at ? old.filter(n => n.id !== noteId) : old.map(n => n.id === noteId ? { ...n, ...patch } as QuickNote : n));
      try {
        let request = supabase.from("quick_notes").update(patch).eq("id", noteId).eq("tenant_id", this.scope.tenantId);
        if (before.revision !== undefined) request = request.eq("revision", before.revision);
        const { data, error } = await request.select().single();
        if (error) throw error;
        const saved = parseNote(data);
        this.setNotes(old => patch.is_archived || patch.deleted_at ? old.filter(n => n.id !== noteId) : old.map(n => n.id === noteId ? { ...n, ...saved } : n));
        await this.persist();
        return saved;
      } catch (error) {
        this.setNotes(old => [...old.filter(n => n.id !== noteId), before]);
        void this.refreshNote(noteId).catch(() => {});
        throw error;
      }
    });
    this.patchQueue.set(noteId, next);
    void next.finally(() => { if (this.patchQueue.get(noteId) === next) this.patchQueue.delete(noteId); }).catch(() => {});
    return next;
  }
  private announce() {
    window.dispatchEvent(new CustomEvent("quick-notes-local-change", { detail: this.scopeId }));
    this.broadcast?.postMessage(this.scopeId);
  }
  acquire() {
    if (++this.refs === 1) this.start();
    return () => { if (--this.refs === 0) { this.stop?.(); this.stop = undefined; } };
  }
  private start() {
    const online = () => { this.emit({ online: navigator.onLine }); void this.sync(); void this.client.invalidateQueries({ queryKey: this.key }); };
    const local = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== this.scopeId) return;
      void this.refreshWrites().then(writes => this.setNotes(old => overlayWrites(old, writes, this.scope))).catch(error => this.emit({ error: getErrorMessage(error) }));
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("quick-notes-local-change", local);
    if (typeof BroadcastChannel !== "undefined") {
      this.broadcast = new BroadcastChannel(`quick-notes:${this.scopeId}`);
      this.broadcast.onmessage = () => { void this.client.invalidateQueries({ queryKey: this.key }); void this.sync(); };
    }
    const channel = supabase.channel(`quick-notes:${this.scopeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quick_notes", filter: `tenant_id=eq.${this.scope.tenantId}` }, payload => {
        const record = payload.eventType === "DELETE" ? payload.old : payload.new;
        if (typeof record.id === "string") void this.refreshNote(record.id).catch(error => this.emit({ error: getErrorMessage(error) }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quick_note_shares", filter: `tenant_id=eq.${this.scope.tenantId}` }, () => { void this.client.invalidateQueries({ queryKey: this.key }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "quick_note_global_shares", filter: `tenant_id=eq.${this.scope.tenantId}` }, () => { void this.client.invalidateQueries({ queryKey: this.key }); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "quick_note_shares" }, () => { void this.client.invalidateQueries({ queryKey: this.key }); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "quick_note_global_shares" }, () => { void this.client.invalidateQueries({ queryKey: this.key }); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "quick_notes" }, payload => { if (typeof payload.old.id === "string") void this.removeCachedNote(payload.old.id); })
      .subscribe(status => { if (status === "SUBSCRIBED") void this.client.invalidateQueries({ queryKey: this.key }, { cancelRefetch: false }); });
    const retryTimer = window.setInterval(() => { void this.sync(); }, 30_000);
    void this.sync();
    this.stop = () => {
      window.removeEventListener("online", online); window.removeEventListener("offline", online);
      window.removeEventListener("quick-notes-local-change", local);
      window.clearInterval(retryTimer); this.broadcast?.close(); this.broadcast = undefined; void supabase.removeChannel(channel);
    };
  }
}
const repositories = new WeakMap<QueryClient, Map<string, QuickNotesRepository>>();
export function getNotesRepository(client: QueryClient, scope: NoteScope) {
  let scopes = repositories.get(client);
  if (!scopes) { scopes = new Map(); repositories.set(client, scopes); }
  let repository = scopes.get(scopeKey(scope));
  if (!repository) { repository = new QuickNotesRepository(scope, client); scopes.set(scopeKey(scope), repository); }
  return repository;
}
