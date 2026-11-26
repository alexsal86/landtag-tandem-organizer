import { describe, expect, it } from "vitest";
import {
  archiveNeighbours, archiveStatusLabel, archiveTargetLabel, buildArchiveEntry, filterArchive, matchesArchiveQuery,
} from "../daySlipArchive";
import type { DaySlipDayData } from "../dayslipTypes";

const html = [
  '<p data-line-id="open">Offener Punkt</p>',
  '<p data-line-id="done" data-done="true">Abgehakter Punkt</p>',
  '<p data-line-id="task" data-done="false">Aufgabe Punkt</p>',
  '<p data-line-id="note">Notiz Punkt</p>',
  '<p data-line-id="snooze">Später Punkt</p>',
].join("");

const day: DaySlipDayData = {
  html,
  plainText: "Offener Punkt",
  completedAt: "2026-11-25T17:00:00.000Z",
  struckLineIds: ["done"],
  resolved: [
    { lineId: "task", text: "Aufgabe Punkt", target: "task" },
    { lineId: "note", text: "Notiz Punkt", target: "note" },
    { lineId: "snooze", text: "Später Punkt", target: "snoozed", snoozeUntil: "2026-12-01" },
    { lineId: "done", text: "Abgehakter Punkt", target: "decision" },
  ],
};

describe("Tageszettel-Archiv", () => {
  it("unterscheidet erledigt, zugewiesen, Wiedervorlage und offen", () => {
    const entry = buildArchiveEntry("2026-11-25", day);
    expect(entry.lines.map(line => [line.id, line.status])).toEqual([
      ["open", "open"],
      ["done", "done"],
      ["task", "assigned"],
      ["note", "assigned"],
      ["snooze", "snoozed"],
    ]);
    expect(entry.counts).toEqual({ done: 1, assigned: 2, snoozed: 1, open: 1 });
    expect(entry.completedAt).toBe("2026-11-25T17:00:00.000Z");
  });

  it("liest den Erledigt-Zustand aus dem gespeicherten Inhalt, auch ohne Tagesliste", () => {
    const withoutMirror: DaySlipDayData = { html, plainText: "" };
    expect(buildArchiveEntry("2026-11-25", withoutMirror).lines.find(line => line.id === "done")?.status).toBe("done");
    expect(buildArchiveEntry("2026-11-25", undefined).lines).toEqual([]);
  });

  it("beschriftet Ziele und Zustände verständlich", () => {
    expect(archiveTargetLabel("task")).toBe("Aufgabe");
    expect(archiveTargetLabel("archived")).toBe("archiviert");
    expect(archiveStatusLabel({ id: "a", text: "x", status: "done" })).toBe("erledigt");
    expect(archiveStatusLabel({ id: "a", text: "x", status: "assigned", target: "task" })).toBe("zugewiesen: Aufgabe");
    expect(archiveStatusLabel({ id: "a", text: "x", status: "snoozed", target: "snoozed" })).toBe("Wiedervorlage");
    expect(archiveStatusLabel({ id: "a", text: "x", status: "open" })).toBe("offen");
  });

  it("sucht über Text, Datum und ohne Rücksicht auf Großschreibung/Umlaute", () => {
    const entries = [buildArchiveEntry("2026-11-25", day), buildArchiveEntry("2026-11-20", undefined)];
    expect(filterArchive(entries, "").map(entry => entry.key)).toEqual(["2026-11-25", "2026-11-20"]);
    expect(filterArchive(entries, "punkt").map(entry => entry.key)).toEqual(["2026-11-25"]);
    expect(filterArchive(entries, "ABGEHAKTER").map(entry => entry.key)).toEqual(["2026-11-25"]);
    expect(filterArchive(entries, "2026-11-20").map(entry => entry.key)).toEqual(["2026-11-20"]);
    expect(filterArchive(entries, "später punkt").map(entry => entry.key)).toEqual(["2026-11-25"]);
    expect(filterArchive(entries, "spater").map(entry => entry.key)).toEqual(["2026-11-25"]);
    expect(matchesArchiveQuery(entries[0], "November 2026")).toBe(true);
  });

  it("navigiert zwischen Archivtagen mit dem älteren Tag als Vorgänger", () => {
    const entries = ["2026-11-25", "2026-11-24", "2026-11-20"].map(key => buildArchiveEntry(key, undefined));
    expect(archiveNeighbours(entries, "2026-11-24")).toEqual({ previousKey: "2026-11-20", nextKey: "2026-11-25" });
    expect(archiveNeighbours(entries, "2026-11-25")).toEqual({ previousKey: "2026-11-24", nextKey: undefined });
    expect(archiveNeighbours(entries, "2026-11-20")).toEqual({ previousKey: undefined, nextKey: "2026-11-24" });
    expect(archiveNeighbours(entries, "2026-01-01")).toEqual({});
  });
});
