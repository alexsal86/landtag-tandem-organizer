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

  it("belegt alle Namensphasen im Gesetzblatt", () => {
    const unverified = ministryPhases.filter(phase => !phase.verified).map(phase => phase.id);
    expect(unverified).toEqual([]);
    for (const phase of ministryPhases) {
      expect(["gesetzblatt", "system"], phase.id).toContain(phase.source.kind);
    }
  });

  it("trennt den Ländlichen Raum 1987 von der Fassung mit Ernährung 1988", () => {
    const gruendung = ministryPhases.find(phase => phase.id === "rural-1987");
    expect(gruendung?.name).toContain("ländlichen Raum");
    expect(gruendung?.name).not.toContain("Ernährung");
    expect(gruendung?.source.citation).toBe("GBl. 1987 S. 191");

    const ernaehrung = ministryPhases.find(phase => phase.id === "rural-1988");
    expect(ernaehrung?.from).toBe("1988-07-06");
    expect(ernaehrung?.name).toContain("Ernährung");
    expect(ministryPhases.find(phase => phase.id === "rural-1987")?.to).toBe("1988-07-05");
  });

  it("führt die Namensstufen ab 2001 lückenlos", () => {
    const erwartet = ["economy-1992", "economy-2011", "economy-2016", "economy-2021", "social-2005", "social-2011", "social-2016", "social-2021", "rural-2001", "rural-2011", "rural-2021", "transport-2011", "housing-2021", "justice-2016", "interior-2016"];
    for (const id of erwartet) expect(ministryPhases.some(phase => phase.id === id), id).toBe(true);
    expect(ministryPhases.find(phase => phase.id === "social-2005")?.from).toBe("2005-05-03");
    expect(ministryPhases.find(phase => phase.id === "economy-1992")?.name).toBe("Wirtschaftsministerium (WM)");
    expect(ministryPhases.filter(phase => phase.from === "2026-05-13").every(phase => phase.source.citation === "GBl. 2026 Nr. 70")).toBe(true);
  });

  it("belegt die 1980er und 2010er Zwischenstufen im Gesetzblatt", () => {
    const forsten = ministryPhases.find(phase => phase.id === "rural-1980");
    expect(forsten?.name).toBe("Ministerium für Ernährung, Landwirtschaft, Umwelt und Forsten");
    expect(forsten?.from).toBe("1980-06-04");
    expect(forsten?.source.citation).toBe("GBl. 1980 S. 361");
    expect(ministryPhases.find(phase => phase.id === "rural-1972")?.to).toBe("1980-06-03");

    const umwelt = ministryPhases.find(phase => phase.id === "environment-2010");
    expect(umwelt?.name).toContain("Umwelt, Naturschutz und Verkehr");
    expect(umwelt?.source.citation).toBe("GBl. 2010 S. 321");
    expect(ministryPhases.find(phase => phase.id === "environment-2005")?.to).toBe("2010-02-28");
    expect(ministryPhases.find(phase => phase.id === "rural-2010")?.name).toContain("Verbraucherschutz");
    expect(ministryPhases.find(phase => phase.id === "social-2010")?.name).toContain("Familien und Senioren");
    expect(ministryPhases.find(phase => phase.id === "transport-2005")?.name).toContain("Innenministerium");
    expect(ministryPhases.find(phase => phase.id === "transport-2010")?.name).toContain("Umwelt, Naturschutz und Verkehr");
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
    expect(umwelt1996 && periodsForPhase(umwelt1996)).toEqual([12, 13]);

    const period13 = phasesForPeriod(13);
    expect(period13.some(phase => phase.lineId === "environment" && phase.name.includes("Umwelt und Verkehr"))).toBe(true);
    const period16 = phasesForPeriod(16);
    expect(period16.every(phase => periodsForPhase(phase).includes(16))).toBe(true);
    expect(period16.find(phase => phase.id === "social-2016")?.name).toContain("Soziales und Integration");
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
