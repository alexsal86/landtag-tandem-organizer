import { describe, expect, it } from "vitest";
import {
  findings, legislativePeriods, ministers, ministryPhases, periodsForPhase, phasesForLine,
  phasesForPeriod, ressortLines,
} from "./data";

describe("Ministerien seit 1952", () => {
  it("übernimmt die Systemdaten der achtzehn Wahlperioden", () => {
    expect(legislativePeriods.map(period => period.number)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
    for (let index = 1; index < legislativePeriods.length; index += 1) {
      expect(Date.parse(legislativePeriods[index].from)).toBeGreaterThan(Date.parse(legislativePeriods[index - 1].from));
    }
    expect(legislativePeriods[0]).toMatchObject({ from: "1952-03-25", to: "1956-03-31" });
    expect(legislativePeriods[16]).toMatchObject({ from: "2021-05-01", to: "2026-04-30" });
    expect(legislativePeriods[17]).toMatchObject({ from: "2026-05-01", to: "2031-04-30", expected: true });
    for (const period of legislativePeriods) {
      expect(period.source.citation, String(period.number)).not.toBe("");
    }
  });

  it("belegt jede Phase mit einer Quelle und einer bekannten Ressortlinie", () => {
    const lineIds = new Set(ressortLines.map(line => line.id));
    for (const phase of ministryPhases) {
      expect(phase.source.citation, phase.id).not.toBe("");
      expect(lineIds.has(phase.lineId), phase.id).toBe(true);
      expect(Number.isNaN(Date.parse(phase.from)), phase.id).toBe(false);
      if (phase.to) expect(Date.parse(phase.to), phase.id).toBeGreaterThanOrEqual(Date.parse(phase.from));
    }
  });

  it("hält die geprüften Kernfakten fest", () => {
    const kultus = phasesForLine("education").find(phase => phase.from === "1954-08-06");
    expect(kultus?.name).toBe("Kultusministerium");
    expect(kultus?.source.citation).toBe("GBl. 1954 S. 109");

    const sozial = phasesForLine("social").find(phase => phase.from === "1996-06-18");
    expect(sozial?.name).toBe("Sozialministerium (SM)");

    const vertriebene = phasesForLine("displaced").at(-1);
    expect(vertriebene?.from).toBe("1960-07-05");
    expect(vertriebene?.source.citation).toBe("GBl. 1960 S. 133");

    expect(findings.length).toBeGreaterThanOrEqual(9);
  });

  it("ordnet Namensphasen den Wahlperioden über die Systemzeiträume zu", () => {
    const gruendung = ministryPhases.find(phase => phase.id === "interior-1952");
    expect(gruendung && periodsForPhase(gruendung)).toContain(1);

    const sozial1996 = ministryPhases.find(phase => phase.id === "social-1996");
    expect(sozial1996 && periodsForPhase(sozial1996)).toContain(12);
    expect(sozial1996 && periodsForPhase(sozial1996)).not.toContain(11);

    const kultus1996 = ministryPhases.find(phase => phase.id === "education-1996");
    expect(kultus1996 && periodsForPhase(kultus1996)).toContain(12);
    expect(kultus1996 && periodsForPhase(kultus1996)).toContain(17);

    const umwelt1996 = ministryPhases.find(phase => phase.id === "environment-1996");
    // Periode 18 beginnt am 1.5.2026, die Bezeichnung gilt bis 12.5.2026.
    expect(umwelt1996 && periodsForPhase(umwelt1996)).toEqual([12, 13, 14, 15, 16, 17, 18]);

    const period16 = phasesForPeriod(16);
    expect(period16.some(phase => phase.lineId === "environment" && phase.name.includes("Umwelt und Verkehr"))).toBe(true);
    expect(period16.every(phase => periodsForPhase(phase).includes(16))).toBe(true);
  });

  it("führt für jede Ressortlinie mindestens eine Amtszeit", () => {
    const lineIds = new Set(ressortLines.map(line => line.id));
    for (const term of ministers) {
      expect(lineIds.has(term.lineId), term.id).toBe(true);
      expect(Number.isNaN(Date.parse(term.from)), term.id).toBe(false);
      if (term.to) expect(Date.parse(term.to), term.id).toBeGreaterThanOrEqual(Date.parse(term.from));
    }
    const covered = new Set(ministers.map(term => term.lineId));
    expect([...lineIds].filter(id => !covered.has(id))).toEqual([]);
  });

  it("enthält die belegten Regierungswechsel an den Ressortspitzen", () => {
    const interior = ministers.filter(term => term.lineId === "interior");
    expect(interior.at(0)).toMatchObject({ name: "Fritz Ulrich", from: "1952-04-25" });
    expect(interior.at(-1)).toMatchObject({ name: "Manuel Hagel", to: null });
    expect(ministers.some(term => term.lineId === "displaced" && term.name === "Eduard Fiedler")).toBe(true);
    expect(ministers.some(term => term.lineId === "family" && term.name === "Brigitte Unger-Soyka")).toBe(true);
    expect(ministers.filter(term => term.lineId === "science").length).toBeGreaterThanOrEqual(5);
  });
});
