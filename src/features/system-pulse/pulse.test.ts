import { describe, expect, it } from "vitest";
import { areaLevel, type PulseArea } from "./pulse";

const area: PulseArea = { id: "a", title: "A", scenarios: ["s1", "s2"], tables: ["t"], next: [] };
const base = { criticalTables: new Set<string>(), warningTables: new Set<string>() };

describe("areaLevel", () => {
  it("ist grün, wenn alle Tests bestanden und keine Lücke", () => expect(areaLevel(area, { ...base, runs: { s1: "ok", s2: "ok" } })).toBe("green"));
  it("ist rot bei fehlgeschlagenem Test", () => expect(areaLevel(area, { ...base, runs: { s1: "ok", s2: "failed" } })).toBe("red"));
  it("ist rot bei kritischer Tabellenlücke", () => expect(areaLevel(area, { runs: { s1: "ok", s2: "ok" }, criticalTables: new Set(["t"]), warningTables: new Set() })).toBe("red"));
  it("ist gelb, wenn ein Test noch fehlt", () => expect(areaLevel(area, { ...base, runs: { s1: "ok" } })).toBe("yellow"));
  it("ist grau, wenn nie geprüft", () => expect(areaLevel(area, { ...base, runs: {} })).toBe("grey"));
});
