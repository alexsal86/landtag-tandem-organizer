import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  rows: new Map<string, unknown[]>(), failedTable: "", files: [] as Array<{ name: string }>, filters: [] as Array<[string, string, unknown]>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const result = () => ({ data: mock.rows.get(table) ?? [], error: mock.failedTable === table ? new Error("Suche fehlgeschlagen") : null });
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => { mock.filters.push([table, column, value]); return query; },
      like: (column: string, value: string) => { mock.filters.push([table, column, value]); return query; },
      maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
      then: (resolve: (value: unknown) => void) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
  storage: { from: () => ({ list: async () => ({ data: mock.files, error: null }) }) },
} }));
import { findLegacySelftestRecords, recoverArtifacts } from "./artifacts";
beforeEach(() => { mock.rows.clear(); mock.files = []; mock.failedTable = ""; mock.filters.length = 0; });
describe("Aufräumen nach unterbrochenen Workflow-Schritten", () => {
  it("sucht ältere Daten ausschließlich anhand Marker, Büro und Ersteller", async () => {
    mock.rows.set("tasks", [{ id: "legacy" }]);
    const result = await findLegacySelftestRecords("office", "user");
    expect(result).toContainEqual({ table: "tasks", id: "legacy" });
    for (const table of ["tasks", "letters", "meetings", "case_items", "appointment_requests"]) {
      expect(mock.filters).toContainEqual([table, "tenant_id", "office"]);
    }
    expect(mock.filters).toContainEqual(["tasks", "user_id", "user"]);
    expect(mock.filters).toContainEqual(["letters", "created_by", "user"]);
    expect(mock.filters).toContainEqual(["tasks", "title", "[SELFTEST]%"]);
  });
  it("findet Archivdateien, Anlagen und Folgeaufgaben über den aufgezeichneten Brief", async () => {
    mock.rows.set("letters", [{ title: "[SELFTEST] Brief (run)", subject: "[SELFTEST] Betreff (run)", tenant_id: "office" }]);
    mock.rows.set("documents", [{ id: "doc", file_path: "archived_letters/archive.pdf" }]);
    mock.rows.set("letter_attachments", [{ id: "attachment", file_path: "letter/upload.txt" }]);
    mock.rows.set("tasks", [{ id: "followup" }]);
    const prefix = `letter_${"[SELFTEST] Brief (run)".replace(/[^a-zA-Z0-9]/g, "_")}_`;
    mock.files = [{ name: `${prefix}123.pdf` }, { name: "unrelated.pdf" }];
    const result = await recoverArtifacts([{ table: "letters", id: "letter" }], []);
    expect(result.records).toEqual(expect.arrayContaining([{ table: "documents", id: "doc" }, { table: "tasks", id: "followup" }, { table: "letter_attachments", id: "attachment" }]));
    expect(result.storageObjects.map(o => o.path)).toContain(`archived_letters/${prefix}123.pdf`);
    expect(result.storageObjects.map(o => o.path)).not.toContain("archived_letters/unrelated.pdf");
    expect(mock.filters).toContainEqual(["documents", "source_letter_id", "letter"]);
    expect(mock.filters).toContainEqual(["tasks", "tenant_id", "office"]);
  });
  it("hält bei fehlgeschlagener Suche den Elternsatz für den nächsten Cleanup-Versuch fest", async () => {
    mock.failedTable = "tasks";
    const result = await recoverArtifacts([{ table: "case_items", id: "case" }], []);
    expect(result.blocked.has("case_items/case")).toBe(true); expect(result.errors).toHaveLength(1);
  });
  it("findet von der Anfrage erzeugte Termine auch ohne aufgezeichnete RPC-Antwort", async () => {
    mock.rows.set("appointment_requests", [{ appointment_id: "appointment" }]);
    const result = await recoverArtifacts([{ table: "appointment_requests", id: "request" }], []);
    expect(result.records).toContainEqual({ table: "appointments", id: "appointment" });
  });
});
