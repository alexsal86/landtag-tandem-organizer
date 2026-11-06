import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ archive: vi.fn(), update: vi.fn(), eq: vi.fn(), insert: vi.fn(), single: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/utils/letterArchiving", () => ({ archiveLetter: mock.archive }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ update: mock.update, insert: mock.insert }),
  storage: { from: () => ({ upload: mock.upload, remove: mock.remove }) },
} }));
import { letterTransitionUpdates, persistLetterTransition, uploadLetterAttachment } from "./letterWorkflow";
beforeEach(() => {
  mock.update.mockReturnValue({ eq: mock.eq }); mock.eq.mockResolvedValue({ error: null });
  mock.insert.mockReturnValue({ select: () => ({ single: mock.single }) });
  mock.upload.mockResolvedValue({ error: null }); mock.remove.mockResolvedValue({ error: null });
  mock.single.mockResolvedValue({ data: { id: "attachment" }, error: null });
  mock.archive.mockResolvedValue({ success: true, documentId: "doc", followUpTaskId: "task" });
});
describe("Gemeinsamer Brief-Workflow", () => {
  it("verweigert übersprungene Freigaben vor jedem Schreibzugriff", async () => {
    await expect(persistLetterTransition("letter", "review", "approved", "user")).rejects.toThrow("Ungültiger Statuswechsel");
    expect(mock.update).not.toHaveBeenCalled(); expect(mock.archive).not.toHaveBeenCalled();
  });
  it("speichert die Freigabestufe mit Bearbeiter", async () => {
    await persistLetterTransition("letter", "review", "pending_approval", "reviewer");
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pending_approval", submitted_for_review_by: "reviewer" }));
    expect(mock.eq).toHaveBeenCalledWith("id", "letter");
  });
  it("führt für versendet die Archivfunktion statt eines direkten Statusupdates aus", async () => {
    const result = await persistLetterTransition("letter", "approved", "sent", "sender");
    expect(mock.archive).toHaveBeenCalledWith("letter", "sender"); expect(mock.update).not.toHaveBeenCalled(); expect(result.archive?.documentId).toBe("doc");
  });
  it("verschweigt fehlgeschlagene Archivierung nicht", async () => {
    mock.archive.mockResolvedValue({ success: false, error: "PDF fehlgeschlagen" });
    await expect(persistLetterTransition("letter", "approved", "sent", "sender")).rejects.toThrow("PDF fehlgeschlagen");
  });
  it("behält Bearbeitungshistorie bei gesperrtem Workflow", () => {
    expect(letterTransitionUpdates("approved", "sent", "sender", true)).not.toHaveProperty("sent_by");
  });
  it("registriert einen Upload vor dem Datenbankeintrag und räumt bei INSERT-Fehler auf", async () => {
    const track = vi.fn();
    mock.single.mockResolvedValue({ data: null, error: new Error("INSERT fehlgeschlagen") });
    await expect(uploadLetterAttachment(new File(["Test"], "test.txt", { type: "text/plain" }), "letter", "user", track)).rejects.toThrow("INSERT fehlgeschlagen");
    expect(track).toHaveBeenCalledOnce(); expect(mock.remove).toHaveBeenCalledWith([track.mock.calls[0][0]]);
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ uploaded_by: "user", file_size: 4 }));
  });
});
