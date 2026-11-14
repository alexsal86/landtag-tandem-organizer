import { describe, expect, it } from "vitest";
import { parseLocalCsv, localMetrics } from "./localModel";
import { scenarioParams, savedScenarioUrl } from "./scenarioStorage";
import { analysisReport } from "./reports";
import type { StoredScenario } from "./workspaceTypes";
const scope = {
  year: 2026,
  ballot: "second" as const,
  district: 1,
  type: "municipality" as const,
  release: "synthetic",
  source: "https://example.org",
  boundary: "explicit-2026",
  preliminary: false,
  verified: true,
};
describe("Gemeindeebene", () => {
  it("erhält Nullwerte und unbekannte Bezugsgrößen getrennt", () => {
    const r = parseLocalCsv(
      "unit_key;name;party;eligible;voters;valid_votes;votes\n08111000;Synthetic;A;;;0;0",
      scope,
    )[0];
    expect(r.eligible).toBeNull();
    expect(r.votes).toBe(0);
    expect(localMetrics(r)).toEqual({ share: null, turnout: null });
  });
  it("verlangt einen expliziten Zuschnitt, geprüfte Quelle und eindeutige Gebiet/Partei-Zeilen", () => {
    const csv =
      "unit_key;name;party;eligible;voters;valid_votes;votes\n08111000;Synthetic;A;100;80;70;30";
    expect(() => parseLocalCsv(csv, { ...scope, verified: false })).toThrow(
      "Quellenprüfung",
    );
    expect(() =>
      parseLocalCsv(csv + "\n08111000;Synthetic;A;100;80;70;30", scope),
    ).toThrow("doppelt");
  });
  it("summiert keine widersprüchlichen Parteinenner oder überhöhten Teilstimmen", () => {
    expect(() =>
      parseLocalCsv(
        "unit_key;name;party;eligible;voters;valid_votes;votes\n08111000;Synthetic;A;100;80;70;40\n08111000;Synthetic;B;100;80;70;40",
        scope,
      ),
    ).toThrow("Parteistimmensumme");
  });
});
describe("Gespeicherte Szenarien", () => {
  it("speichert keine regionalen, Navigations- oder fremden URL-Parameter", () => {
    expect(
      scenarioParams(
        new URLSearchParams(
          "researchTool=scenario&analysisYear=2026&scenarioDelta_CDU=3&access_token=secret&redirect=https://example.org",
        ),
      ),
    ).toEqual({
      researchTool: "scenario",
      analysisYear: "2026",
      scenarioDelta_CDU: "3",
    });
    expect(() =>
      scenarioParams(
        new URLSearchParams("researchTool=scenario&scenarioDistrict=1"),
      ),
    ).toThrow("Regionale");
  });
  it("öffnet ausschließlich die lokale Datenansicht, nicht eine gespeicherte Weiterleitung", () => {
    const row = {
      id: "saved",
      year: 2026,
      ballot: "second",
      model_version: "bw-lwg-2026-v1",
      params: { redirect: "https://example.org", seatSecond_CDU: "2" },
    } as StoredScenario;
    const url = savedScenarioUrl(row);
    expect(url).toMatch(/^\/daten\?/);
    expect(url).toContain("researchTool=seats");
    expect(url).not.toContain("redirect");
  });
});
describe("Statischer Bericht", () => {
  it("entfernt ausführbare Inhalte und speichert die tatsächliche Auswahl", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<h2>Synthetic</h2><input value="alt"><script>alert(1)</script><a href="javascript:alert(1)">X</a><div data-report-exclude>privates Formular</div><svg width="100" height="100"><path d="M0 0 L10 10"/></svg>';
    root.querySelector("input")!.value = "aktuell";
    const html = analysisReport(
      root,
      "Titel <safe>",
      "/daten?analysisYear=2026",
      "synthetic",
    );
    expect(html).toContain("aktuell");
    expect(html).toContain("Titel &lt;safe&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("privates Formular");
    expect(html).toContain("<svg");
  });
});
