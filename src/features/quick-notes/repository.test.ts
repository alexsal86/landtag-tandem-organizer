import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickNotesRepository, notesKey, overlayWrites } from "./repository";
import type { QuickNote } from "./types";
import type { NoteWrite } from "./storage";
import { noteStorage } from "./storage";
import { fetchNotes, sendWrite } from "./api";

const mocks = vi.hoisted(() => ({ single: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() }));
vi.mock("./storage", () => ({
  scopeKey: (scope: { userId: string; tenantId: string }) => `${scope.userId}:${scope.tenantId}`,
  noteStorage: { writes: vi.fn(), putWrite: vi.fn(), completeWrite: vi.fn(), deleteWrite: vi.fn(), readSnapshot: vi.fn(), writeSnapshot: vi.fn(), removeSnapshot: vi.fn() },
}));
vi.mock("./api", () => ({ fetchNotes: vi.fn(), sendWrite: vi.fn(), parseNote: (value: unknown) => value, isNetworkError: (error: unknown) => error instanceof TypeError }));
vi.mock("@/integrations/supabase/client", () => {
  const query = { update: () => query, eq: () => query, select: () => query, single: mocks.single };
  return { supabase: { from: () => query, channel: mocks.channel, removeChannel: mocks.removeChannel } };
});
const scope = { userId: "user", tenantId: "tenant" };
const base: QuickNote = { id: "note", tenant_id: "tenant", user_id: "user", revision: 4, title: "Titel", content: "Original", color: null, is_pinned: false, created_at: "2026-11-04T10:00:00Z", updated_at: "2026-11-04T10:00:00Z" };
let writes: Map<string, NoteWrite>;
let snapshots: Map<string, QuickNote[]>;
let connected: boolean;
let client: QueryClient;
let repo: QuickNotesRepository;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
beforeEach(() => {
  vi.clearAllMocks(); connected = false; writes = new Map(); snapshots = new Map();
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => connected);
  vi.mocked(noteStorage.writes).mockImplementation(async key => [...writes.values()].filter(write => write.scope === key));
  vi.mocked(noteStorage.putWrite).mockImplementation(async write => { writes.set(write.id, clone(write)); });
  vi.mocked(noteStorage.deleteWrite).mockImplementation(async id => { writes.delete(id); });
  vi.mocked(noteStorage.completeWrite).mockImplementation(async (write, revision) => {
    for (const next of writes.values()) if (next.dependsOn === write.id) writes.set(next.id, { ...next, dependsOn: undefined, baseRevision: revision });
    writes.delete(write.id);
  });
  vi.mocked(noteStorage.readSnapshot).mockImplementation(async key => snapshots.get(key));
  vi.mocked(noteStorage.writeSnapshot).mockImplementation(async (key, notes) => { snapshots.set(key, clone(notes)); });
  vi.mocked(noteStorage.removeSnapshot).mockImplementation(async key => { snapshots.delete(key); });
  vi.mocked(fetchNotes).mockResolvedValue([base]);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(notesKey(scope), [base]);
  repo = new QuickNotesRepository(scope, client);
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  mocks.channel.mockReturnValue(channel);
});

describe("offline notes and sync", () => {
  it("commits a new note locally before returning and restores it after a fresh repository mounts", async () => {
    const created = await repo.queue({ title: "Unterwegs", content: "Im Funkloch" });
    await repo.sync();
    expect(sendWrite).not.toHaveBeenCalled();
    expect(writes.size).toBe(1);
    expect(repo.getNotes().find(note => note.id === created.id)?.sync_status).toBe("pending");
    const fresh = new QuickNotesRepository(scope, new QueryClient());
    expect((await fresh.read()).find(note => note.id === created.id)?.content).toBe("Im Funkloch");
  });
  it("keeps the editor's draft when the durable local commit fails", async () => {
    vi.mocked(noteStorage.putWrite).mockRejectedValueOnce(new Error("QuotaExceeded"));
    await expect(repo.queue({ title: "Entwurf", content: "Nicht verlieren" })).rejects.toThrow("QuotaExceeded");
    expect(repo.getNotes()).toEqual([base]); expect(sendWrite).not.toHaveBeenCalled();
  });
  it("reuses operation and note IDs after an uncertain transport failure", async () => {
    const created = await repo.queue({ title: "Einmal", content: "Text" }); await repo.sync();
    connected = true;
    vi.mocked(sendWrite).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await repo.sync();
    expect(writes.size).toBe(1);
    const operation = [...writes.values()][0];
    vi.mocked(sendWrite).mockResolvedValueOnce({ ...base, id: created.id, revision: 0, content: "Text" });
    await repo.sync();
    expect(vi.mocked(sendWrite).mock.calls[0][1].id).toBe(operation.id);
    expect(vi.mocked(sendWrite).mock.calls[1][1].id).toBe(operation.id);
    expect(writes.size).toBe(0);
    expect(repo.getNotes().filter(note => note.id === created.id)).toHaveLength(1);
  });
  it("rebases consecutive offline edits only after their predecessor is acknowledged", async () => {
    await repo.queue({ note: base, title: base.title, content: "Erster Stand" }); await repo.sync();
    await repo.queue({ note: repo.getNotes()[0], title: base.title, content: "Zweiter Stand" }); await repo.sync();
    expect(repo.getNotes()[0].content).toBe("Zweiter Stand");
    connected = true;
    vi.mocked(sendWrite).mockImplementation(async (_scope, write) => ({ ...base, content: write.content, revision: (write.baseRevision ?? -1) + 1 }));
    await repo.sync();
    expect(vi.mocked(sendWrite).mock.calls.map(call => call[1].baseRevision)).toEqual([4,5]);
    expect(repo.getNotes()[0].revision).toBe(6); expect(writes.size).toBe(0);
  });
  it("rebases through this device's acknowledged saves, but never through unrelated remote revisions", async () => {
    await repo.queue({ note: base, title: base.title, content: "Own edit" }); await repo.sync();
    connected = true;
    vi.mocked(sendWrite).mockImplementation(async (_scope, write) => ({ ...base, content: write.content, revision: (write.baseRevision ?? -1) + 1 }));
    await repo.sync();
    connected = false;
    await repo.queue({ note: base, title: base.title, content: "Own next edit" }); await repo.sync();
    expect([...writes.values()][0].baseRevision).toBe(5);
    connected = true; await repo.sync();
    client.setQueryData(notesKey(scope), [{ ...base, revision: 20, content: "Unrelated remote edit" }]);
    connected = false;
    await repo.queue({ note: base, title: base.title, content: "Stale editor" }); await repo.sync();
    expect([...writes.values()][0].baseRevision).toBe(6);
  });
  it("preserves conflicting text and offers a durable copy instead of overwriting the server", async () => {
    await repo.queue({ note: base, title: base.title, content: "Mein lokaler Text" }); await repo.sync();
    connected = true;
    vi.mocked(sendWrite).mockRejectedValue({ message: "NOTE_CONFLICT: Die Notiz wurde inzwischen geändert" });
    await repo.sync();
    expect(repo.getSnapshot().writes[0].status).toBe("conflict");
    expect(repo.getNotes()[0].content).toBe("Mein lokaler Text");
    connected = false;
    await repo.rescue(repo.getSnapshot().writes[0]);
    expect([...writes.values()]).toHaveLength(1);
    expect([...writes.values()][0].kind).toBe("create");
    expect([...writes.values()][0].noteId).not.toBe(base.id);
    expect([...writes.values()][0].content).toBe("Mein lokaler Text");
  });
  it("isolates caches and operations by both user and tenant", async () => {
    await repo.queue({ title: "Privat", content: "Tenant A" }); await repo.sync();
    const other = new QuickNotesRepository({ userId: "other", tenantId: "tenant" }, client);
    expect(await other.read()).toEqual([]);
    expect(overlayWrites([], [...writes.values()], { userId: "user", tenantId: "other" })).toEqual([]);
    await expect(repo.queue({ note: { ...base, tenant_id: "other" }, title: "x", content: "x" })).rejects.toThrow("anderen Arbeitsbereich");
  });
  it("discards cached server content after a confirmed authorization error", async () => {
    snapshots.set("user:tenant", [base]); connected = true;
    vi.mocked(fetchNotes).mockRejectedValueOnce({ message: "Kein Zugriff", code: "42501" });
    await expect(repo.read()).rejects.toMatchObject({ code: "42501" });
    expect(repo.getNotes()).toEqual([]); expect(snapshots.has("user:tenant")).toBe(false);
  });
});
describe("shared cache and mutations", () => {
  it("rolls back only the failed optimistic mutation, preserving unrelated notes", async () => {
    connected = true;
    client.setQueryData(notesKey(scope), [base, { ...base, id: "other", content: "Andere Änderung" }]);
    let reject!: (reason: Error) => void;
    mocks.single.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    const request = repo.patch("note", { is_pinned: true });
    await vi.waitFor(() => expect(repo.getNotes()[0].is_pinned).toBe(true));
    reject(new Error("Keine Berechtigung"));
    await expect(request).rejects.toThrow("Keine Berechtigung");
    expect(repo.getNotes().find(note => note.id === "other")?.content).toBe("Andere Änderung");
  });
  it("shares one realtime channel across consumers and closes it after the last consumer", async () => {
    const stop1 = repo.acquire(); const stop2 = repo.acquire();
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    expect(mocks.channel).toHaveBeenCalledWith("quick-notes:user:tenant");
    stop1(); expect(mocks.removeChannel).not.toHaveBeenCalled();
    stop2(); expect(mocks.removeChannel).toHaveBeenCalledOnce();
    await repo.sync();
  });
});
