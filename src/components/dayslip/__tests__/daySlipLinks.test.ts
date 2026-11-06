import { describe, it, expect } from "vitest";
import { appendEntries, normalizeStore, emptyDay } from "../daySlipState";

describe("Tageszettel-Verknüpfungen", () => {
  it("übernommener Vorgang trägt die Verknüpfung in der Zeile selbst", () => {
    const day = appendEntries(emptyDay(), [{ id: "l1", text: "Nachhalten", source: { type: "case", id: "c1" } }]);
    expect(day.html).toContain('data-source-type="case"');
    expect(day.html).toContain('data-source-id="c1"');
  });
  it("Verknüpfung überlebt Neuladen, auch wenn die separate Liste leer ist", () => {
    const day = appendEntries(emptyDay(), [{ id: "l1", text: "Nachhalten", source: { type: "case", id: "c1" } }]);
    const store = normalizeStore({ "2026-11-06": { ...day, sources: {} } });
    expect(store["2026-11-06"].sources?.l1).toEqual({ type: "case", id: "c1" });
  });
  it("alte Tageszettel mit separater Liste werden in die Zeile übernommen", () => {
    const store = normalizeStore({ "2026-11-05": { html: '<p data-line-id="l2">Notiz</p>', plainText: "Notiz", sources: { l2: { type: "note", id: "n1" } } } });
    expect(store["2026-11-05"].html).toContain('data-source-id="n1"');
    expect(store["2026-11-05"].nodes).toBeUndefined();
  });
});
