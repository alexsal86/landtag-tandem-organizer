import { describe, expect, it } from "vitest";
import {
  findings, legislativePeriods, ministryPhases, periodsForPhase, phasesForLine, phasesForPeriod, ressortLines,
} from "./data";

describe("Ministerien seit 1952", () => {
  it("kennt achtzehn Wahlperioden ohne Lücke", () => {
    expect(legislativePeriods.map(period => period.number)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
    for (let index = 1; index < legislativePeriods.length; index += 1) {
      expect(Date.parse(legislativePeriods[index].from)).toBeGreaterThan(Date.parse(legislativePeriods[index - 1].from));
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

  it("ordnet Phasen den Wahlperioden über die Laufzeit zu", () => {
    const gruendung = ministryPhases.find(phase => phase.id === "interior-1952");
    expect(gruendung && periodsForPhase(gruendung)).toContain(1);

    const sozial1996 = ministryPhases.find(phase => phase.id === "social-1996");
    expect(sozial1996 && periodsForPhase(sozial1996)).toContain(12);
    expect(sozial1996 && periodsForPhase(sozial1996)).not.toContain(11);

    const period16 = phasesForPeriod(16);
    expect(period16.some(phase => phase.lineId === "environment" && phase.name.includes("Umwelt und Verkehr"))).toBe(true);
  });
});
