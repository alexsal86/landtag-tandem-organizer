import { describe, expect, it } from "vitest";
import { adjustedRand, clusterDistricts, typologyFeatures } from "./clustering";
import {
  researchDataset,
  coherentDataset,
  type ResearchDistrict,
} from "./data";
import { linearModel } from "./regression";
import { parseStructureCsv } from "./structureCsv";
import { flowSensitivity, projectShares, simulateShares } from "./scenarios";
const districts = (): ResearchDistrict[] =>
  Array.from({ length: 70 }, (_, i) => ({
    number: i + 1,
    name: `Synthetic ${i + 1}`,
    shares: { CDU: 40, GRÜNE: 40, REST: 20 },
    valid: 1000,
    voters: 1100,
    eligible: 2000,
    turnout: 55,
    preliminary: false,
    release: "same",
    identity: "verified",
  }));
describe("Forschungsdaten und CSV", () => {
  it("erfindet keine fehlenden oder historischen AfD-Nullwerte", () => {
    expect(researchDataset(undefined, 2011, "single").parties).not.toContain(
      "AfD",
    );
    expect(researchDataset(undefined, 2026, "second").rows).toHaveLength(0);
  });
  it("akzeptiert nur eindeutige Wahlkreise im gewählten Jahr und erhält fehlende Werte", () => {
    const csv = "district_number;year;arbeitslosigkeit\n1;2026;3,5\n2;2026;\n";
    expect(parseStructureCsv(csv, 2026).rows).toEqual([
      { number: 1, values: { arbeitslosigkeit: 3.5 } },
      { number: 2, values: { arbeitslosigkeit: null } },
    ]);
    expect(() => parseStructureCsv(csv, 2021)).toThrow("Bezugsjahr");
    expect(() => parseStructureCsv(csv + "1;2026;4\n", 2026)).toThrow(
      "doppelt",
    );
  });
  it("ersetzt nichtnumerische Strukturdaten nicht durch null oder null Prozent", () => {
    expect(() =>
      parseStructureCsv("district_number;year;value\n1;2026;unbekannt", 2026),
    ).toThrow();
  });
  it("verlangt vollständige und kohärente Daten für Landesaggregation", () => {
    expect(coherentDataset(districts())).toBe(true);
    expect(coherentDataset(districts().slice(1))).toBe(false);
    const rows = districts();
    rows[0].release = "other";
    expect(coherentDataset(rows)).toBe(false);
  });
});
describe("Explorative Gruppen", () => {
  const features = Array.from({ length: 20 }, (_, i) => ({
    number: i + 1,
    name: `Synthetic ${i}`,
    values: [i < 10 ? -10 : 10, (i % 10) / 100],
    raw: { CDU: i < 10 ? 10 : 90 },
  }));
  it("berechnet reproduzierbare Gruppen und vergleicht Ward mit k-means", () => {
    const result = clusterDistricts(features, 2),
      again = clusterDistricts(features, 2),
      ward = clusterDistricts(features, 2, "ward");
    expect(result.labels).toEqual(again.labels);
    expect(adjustedRand(result.labels, ward.labels)).toBe(1);
    expect(result.silhouette).toBeGreaterThan(0.9);
    expect(result.resampleAgreement).toBeCloseTo(1);
  });
  it("ist invariant gegenüber Gruppenbezeichnungen", () => {
    expect(adjustedRand([0, 0, 1, 1], [7, 7, 4, 4])).toBe(1);
    expect(adjustedRand([0, 0, 1, 1], [0, 1, 0, 1])).toBeCloseTo(-0.5);
    expect(adjustedRand([0], [0])).toBeNull();
  });
  it("weist unzureichende Stichproben und konstante Muster zurück", () => {
    expect(() => clusterDistricts(features.slice(0, 4), 2)).toThrow();
    expect(() =>
      clusterDistricts(
        features.map((r) => ({ ...r, values: [0, 0] })),
        2,
      ),
    ).toThrow();
  });
  it("vergleicht Grenzen und Ergebnisstatus vor historischen Merkmalen", () => {
    const current = {
      rows: districts(),
      excluded: [],
      parties: ["CDU", "GRÜNE"],
    };
    const old = {
      ...current,
      rows: districts().map((r) => ({ ...r, identity: null })),
    };
    expect(typologyFeatures(current, old, false).rows).toHaveLength(0);
    expect(typologyFeatures(current, old, true).rows).toHaveLength(70);
    const changed = {
      ...current,
      rows: districts().map((r) => ({ ...r, identity: "different" })),
    };
    expect(typologyFeatures(current, changed, true).rows).toHaveLength(0);
    const preliminary = {
      ...current,
      rows: districts().map((r) => ({ ...r, preliminary: true })),
    };
    expect(typologyFeatures(current, preliminary, true).rows).toHaveLength(0);
  });
});
describe("Einfaktorielle OLS-Diagnostik", () => {
  it("rekonstruiert eine bekannte Gerade und Leave-one-out-Vorhersagen", () => {
    const r = linearModel(
      Array.from({ length: 12 }, (_, i) => ({
        number: i + 1,
        name: "Synthetic",
        x: i,
        y: 1 + 2 * i,
      })),
    );
    expect(r.slope).toBeCloseTo(2);
    expect(r.intercept).toBeCloseTo(1);
    expect(r.rSquared).toBeCloseTo(1);
    expect(r.looRmse).toBeCloseTo(0);
    expect(r.residuals.every((p) => Math.abs(p.residual) < 1e-9)).toBe(true);
    expect(r.residuals.every((p) => p.cooksDistance === null)).toBe(true);
  });
  it("weist fehlende Streuung und doppelte Gebiete zurück", () => {
    expect(() =>
      linearModel(
        Array.from({ length: 12 }, (_, i) => ({
          number: i + 1,
          name: "Synthetic",
          x: 1,
          y: i,
        })),
      ),
    ).toThrow("Streuung");
    expect(() =>
      linearModel(
        Array.from({ length: 12 }, (_, i) => ({
          number: 1,
          name: "Synthetic",
          x: i,
          y: i,
        })),
      ),
    ).toThrow();
  });
});
describe("Hypothetische Szenarien", () => {
  it("projiziert auf nichtnegative Anteile mit Summe 100", () => {
    const result = projectShares([-5, 50, 55]);
    expect(result.every((v) => v >= 0)).toBe(true);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(projectShares([20, 30, 50])).toEqual([20, 30, 50]);
  });
  it("übernimmt Nulldeltas unverändert und verschiebt die Restkategorie konsistent", () => {
    const base = simulateShares(districts(), ["CDU", "GRÜNE"], {});
    expect(base.adjusted).toBe(0);
    expect(base.rows[0].shares).toEqual(districts()[0].shares);
    const changed = simulateShares(districts(), ["CDU", "GRÜNE"], {
      CDU: 5,
      GRÜNE: -10,
    });
    expect(changed.achieved.CDU).toBeCloseTo(45);
    expect(changed.achieved.REST).toBeCloseTo(25);
  });
  it("weist unmögliche Landesziele zurück und kennzeichnet lokale Korrekturen", () => {
    expect(() =>
      simulateShares(districts(), ["CDU", "GRÜNE"], { CDU: 55 }),
    ).toThrow("Restkategorie");
    const rows = districts();
    rows[0].shares = { CDU: 1, GRÜNE: 40, REST: 59 };
    const changed = simulateShares(rows, ["CDU", "GRÜNE"], { CDU: -5 });
    expect(changed.adjusted).toBe(1);
    expect(
      changed.rows.every(
        (r) =>
          Math.abs(Object.values(r.shares).reduce((a, b) => a + b, 0) - 100) <
          1e-8,
      ),
    ).toBe(true);
    expect(() => simulateShares(rows.slice(1), ["CDU", "GRÜNE"], {})).toThrow(
      "70 vollständige",
    );
  });
  it("berechnet eine ausdrücklich gewählte regionale Annahme", () => {
    const r = simulateShares(
      districts(),
      ["CDU", "GRÜNE"],
      {},
      { district: 1, party: "CDU", delta: 5 },
    );
    expect(r.rows[0].shares.CDU).toBeCloseTo(45);
    expect(r.rows[0].shares.REST).toBeCloseTo(15);
    expect(r.rows[1].shares.CDU).toBeCloseTo(40);
  });
});
describe("Wanderungsannahmen", () => {
  it("wahrt den Saldo ohne Gegenströme zu behaupten", () => {
    const r = flowSensitivity(500, 100, 300, 50)!;
    expect(r.assumedIn - r.assumedOut).toBe(500);
    expect(r).toMatchObject({
      inLow: 550,
      inHigh: 850,
      outLow: 100,
      outHigh: 300,
    });
    expect(
      flowSensitivity(-500, 100, 300, 0)!.assumedIn -
        flowSensitivity(-500, 100, 300, 0)!.assumedOut,
    ).toBe(-500);
  });
  it("belässt fehlende Salden unbekannt und verwirft ungültige Annahmen", () => {
    expect(flowSensitivity(null, 0, 100, 0)).toBeNull();
    expect(flowSensitivity(0, 0, 100, 0)?.assumedIn).toBe(50);
    expect(flowSensitivity(0, 100, 0, 0)).toBeNull();
    expect(flowSensitivity(0, 0.5, 100, 0)).toBeNull();
  });
});
