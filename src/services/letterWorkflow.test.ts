import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ archive: vi.fn(), update: vi.fn(), eq: vi.fn(), insert: vi.fn(), single: vi.fn(), upload: vi.fn(), remove: vi.fn(), rpc: vi.fn() }));
vi.mock("@/utils/letterArchiving", () => ({ archiveLetter: mock.archive }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ update: mock.update, insert: mock.insert }),
  rpc: mock.rpc,
  storage: { from: () => ({ upload: mock.upload, remove: mock.remove }) },
} }));
import { approveLetterWithoutReview, letterApprovalSteps, letterReturnTarget, letterTransitionUpdates, persistLetterTransition, returnLetterForRevision, uploadLetterAttachment } from "./letterWorkflow";
beforeEach(() => {
  mock.update.mockReturnValue({ eq: mock.eq }); mock.eq.mockResolvedValue({ error: null });
  mock.insert.mockReturnValue({ select: () => ({ single: mock.single }) });
  mock.upload.mockResolvedValue({ error: null }); mock.remove.mockResolvedValue({ error: null });
  mock.single.mockResolvedValue({ data: { id: "attachment" }, error: null });
  mock.archive.mockResolvedValue({ success: true, documentId: "doc", followUpTaskId: "task" });
  mock.rpc.mockResolvedValue({ data: "draft", error: null });
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
  it("zieht die Folgeaufgabe über das RPC nach, wenn die Archivfunktion keine ID meldet", async () => {
    mock.archive.mockResolvedValue({ success: true, documentId: "doc", followUpTaskId: null });
    mock.rpc.mockResolvedValue({ data: "task-from-db", error: null });
    const result = await persistLetterTransition("letter", "approved", "sent", "sender");
    expect(mock.rpc).toHaveBeenCalledWith("create_letter_archive_follow_up_task", { _letter_id: "letter" });
    expect(result.archive?.followUpTaskId).toBe("task-from-db");
    expect(result.archive?.documentId).toBe("doc");
  });
  it("fragt das RPC nicht, wenn die Archivfunktion eine Folgeaufgabe meldet", async () => {
    await persistLetterTransition("letter", "approved", "sent", "sender");
    expect(mock.rpc).not.toHaveBeenCalledWith("create_letter_archive_follow_up_task", expect.anything());
  });
  it("verschweigt einen Fehler der Folgeaufgabe nicht", async () => {
    mock.archive.mockResolvedValue({ success: true, documentId: "doc", followUpTaskId: null });
    mock.rpc.mockResolvedValue({ data: null, error: new Error("Folgeaufgabe nur für versendete Briefe") });
    await expect(persistLetterTransition("letter", "approved", "sent", "sender")).rejects.toThrow("versendete Briefe");
  });
  it("verschweigt fehlgeschlagene Archivierung nicht", async () => {
    mock.archive.mockResolvedValue({ success: false, error: "PDF fehlgeschlagen" });
    await expect(persistLetterTransition("letter", "approved", "sent", "sender")).rejects.toThrow("PDF fehlgeschlagen");
  });
  it("führt die Freigabe ohne Prüfung über die erlaubten Kanten", async () => {
    const result = await approveLetterWithoutReview("letter", "draft", "author");
    expect(result.steps).toEqual(["pending_approval", "approved"]);
    expect(mock.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: "pending_approval" }));
    expect(mock.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: "approved" }));
  });
  it("überspringt aus pending_approval nur die letzte Stufe", () => {
    expect(letterApprovalSteps("pending_approval")).toEqual(["approved"]);
  });
  it("verweigert die Abkürzung aus Endzuständen", async () => {
    expect(() => letterApprovalSteps("sent")).toThrow("nicht möglich");
    await expect(approveLetterWithoutReview("letter", "archived", "author")).rejects.toThrow("nicht möglich");
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("behält Bearbeitungshistorie bei gesperrtem Workflow", () => {
    expect(letterTransitionUpdates("approved", "sent", "sender", true)).not.toHaveProperty("sent_by");
  });
  it("legt Briefanlagen im Benutzerordner ab, damit die Storage-Policy sie annimmt", async () => {
    const track = vi.fn();
    const file = new File(["Inhalt"], "anlage.txt", { type: "text/plain" });
    const attachment = await uploadLetterAttachment(file, "letter-1", "user-1", track);
    const [path] = mock.upload.mock.calls[0];
    // Regression: der Bucket "documents" verlangt auth.uid() als ersten Pfadabschnitt.
    expect(path.split("/")[0]).toBe("user-1");
    expect(path).toMatch(/^user-1\/letter-1\/[0-9a-f-]{36}_anlage\.txt$/);
    expect(mock.upload).toHaveBeenCalledWith(path, file);
    expect(track).toHaveBeenCalledWith(path);
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ letter_id: "letter-1", file_path: path, uploaded_by: "user-1" }));
    expect(attachment).toEqual({ id: "attachment" });
  });
  it("gibt einen Brief aus der Prüfung über das RPC mit Begründung zurück", async () => {
    const result = await returnLetterForRevision({ letterId: "letter", from: "review", userId: "reviewer", reason: "  Absatz 2 bitte kürzen.  " });
    expect(mock.rpc).toHaveBeenCalledWith("return_letter_for_revision", {
      _letter_id: "letter",
      _reason: "Absatz 2 bitte kürzen.",
    });
    expect(result.target).toBe("draft");
    expect(result.updates).toMatchObject({
      status: "draft",
      revision_comment: "Absatz 2 bitte kürzen.",
      revision_requested_by: "reviewer",
    });
    // Der Status darf nicht zusätzlich direkt geschrieben werden.
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("übernimmt den Zielstatus aus der Datenbank", async () => {
    mock.rpc.mockResolvedValue({ data: "revision_requested", error: null });
    const result = await returnLetterForRevision({ letterId: "letter", from: "pending_approval", userId: "reviewer", reason: "Bitte überarbeiten" });
    expect(result.target).toBe("revision_requested");
    expect(result.updates).toMatchObject({ status: "revision_requested" });
  });

  it("meldet die Rollenprüfung des RPC als Fehler weiter", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: new Error("Nur zugewiesene Prüfer dürfen den Brief zurückgeben") });
    await expect(returnLetterForRevision({ letterId: "letter", from: "review", userId: "fremd", reason: "Bitte kürzen" })).rejects.toThrow("zugewiesene Prüfer");
  });

  it("verlangt für die Rückgabe eine Begründung und ruft das RPC nicht auf", async () => {
    await expect(returnLetterForRevision({ letterId: "letter", from: "review", userId: "reviewer", reason: "   " })).rejects.toThrow("Begründung");
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("verweigert Rückgaben aus Zuständen ohne Rückgabekante", async () => {
    expect(() => letterReturnTarget("draft")).toThrow("nicht möglich");
    await expect(returnLetterForRevision({ letterId: "letter", from: "approved", userId: "reviewer", reason: "zu spät" })).rejects.toThrow("nicht möglich");
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("registriert einen Upload vor dem Datenbankeintrag und räumt bei INSERT-Fehler auf", async () => {
    const track = vi.fn();
    mock.single.mockResolvedValue({ data: null, error: new Error("INSERT fehlgeschlagen") });
    await expect(uploadLetterAttachment(new File(["Test"], "test.txt", { type: "text/plain" }), "letter", "user", track)).rejects.toThrow("INSERT fehlgeschlagen");
    expect(track).toHaveBeenCalledOnce(); expect(mock.remove).toHaveBeenCalledWith([track.mock.calls[0][0]]);
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ uploaded_by: "user", file_size: 4 }));
  });
});
