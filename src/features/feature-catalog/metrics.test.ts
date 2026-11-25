import { describe, expect, it } from "vitest";
import { catalogAreas, catalogFeatures } from "./inventory";
import {
  EMPTY_FILTERS,
  computeMetrics,
  filterFeatures,
  hasAnyTest,
  isReviewCandidate,
  matchesQuery,
  validateFeatureSet,
} from "./metrics";
import type { FeatureDefinition } from "./types";

const minimal = (overrides: Partial<FeatureDefinition> = {}): FeatureDefinition => ({
  id: "test.feature",
  area: "aufgaben",
  subarea: "Test",
  name: "Testfunktion",
  description: "Beschreibung",
  category: "fachlich",
  implementationStatus: "implementiert",
  integrationStatus: "ui",
  coverage: "keine",
  testResult: "nicht-ausgefuehrt",
  evidence: ["src/App.tsx"],
  ...overrides,
});

describe("Funktionskatalog: Struktur", () => {
  it("enthält keine strukturellen Fehler", () => {
    expect(validateFeatureSet(catalogFeatures)).toEqual([]);
  });

  it("vergibt eindeutige IDs und ordnet jede Funktion einem Bereich zu", () => {
    const ids = catalogFeatures.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    const areaIds = new Set(catalogAreas.map((area) => area.id));
    expect(catalogFeatures.every((feature) => areaIds.has(feature.area))).toBe(true);
  });

  it("führt mindestens einen Quellcode-Nachweis je Funktion", () => {
    expect(catalogFeatures.every((feature) => feature.evidence.length > 0)).toBe(true);
  });

  it("erkennt doppelte IDs und fehlende Nachweise", () => {
    const issues = validateFeatureSet([
      minimal(),
      minimal(),
      minimal({ id: "test.ohne-nachweis", evidence: [] }),
    ]);
    expect(issues).toContain("Doppelte Funktions-ID: test.feature");
    expect(issues.some((issue) => issue.includes("Quellcode-Nachweis"))).toBe(true);
  });

  it("erkennt Abdeckungsangaben ohne zugeordneten Test", () => {
    const issues = validateFeatureSet([minimal({ coverage: "unit" })]);
    expect(issues.some((issue) => issue.includes('"unit" ohne zugeordneten Test'))).toBe(true);
  });

  it("erkennt unbekannte Abhängigkeiten", () => {
    const issues = validateFeatureSet([minimal({ dependsOn: ["gibt.es.nicht"] })]);
    expect(issues).toContain("test.feature: unbekannte Abhängigkeit gibt.es.nicht");
  });
});

describe("Funktionskatalog: Kennzahlen", () => {
  it("berechnet Kennzahlen ausschließlich aus den übergebenen Daten", () => {
    const features = [
      minimal({ id: "a", implementationStatus: "implementiert", scenarios: ["x"] }),
      minimal({ id: "b", implementationStatus: "teilweise", unitTests: ["src/App.test.ts"] }),
      minimal({ id: "c", implementationStatus: "verwaist", coverage: "keine" }),
    ];
    const metrics = computeMetrics(features);
    expect(metrics.features).toBe(3);
    expect(metrics.areas).toBe(1);
    expect(metrics.implemented).toBe(1);
    expect(metrics.partial).toBe(1);
    expect(metrics.orphaned).toBe(1);
    expect(metrics.withSelftest).toBe(1);
    expect(metrics.withUnitTest).toBe(1);
    expect(metrics.withoutAnyTest).toBe(1);
    expect(metrics.missingDocumentation).toBe(3);
  });

  it("zählt deaktivierte Funktionen getrennt von verwaisten", () => {
    const metrics = computeMetrics([
      minimal({ id: "a", implementationStatus: "deaktiviert" }),
      minimal({ id: "b", implementationStatus: "verwaist" }),
    ]);
    expect(metrics.disabled).toBe(1);
    expect(metrics.orphaned).toBe(1);
  });

  it("leitet aus dem Katalog konsistente Gesamtkennzahlen ab", () => {
    const metrics = computeMetrics(catalogFeatures);
    expect(metrics.features).toBe(catalogFeatures.length);
    expect(metrics.areas).toBe(catalogAreas.length);
    expect(metrics.withoutAnyTest).toBe(catalogFeatures.filter((feature) => !hasAnyTest(feature)).length);
    expect(metrics.reviewCandidates).toBe(catalogFeatures.filter(isReviewCandidate).length);
    expect(metrics.withBrowserTest).toBe(catalogFeatures.filter((feature) => feature.e2eTests.length > 0).length);
  });
});

describe("Funktionskatalog: Filter und Suche", () => {
  it("filtert nach Bereich, Status und Abdeckung", () => {
    const result = filterFeatures(catalogFeatures, {
      ...EMPTY_FILTERS,
      area: "aufgaben",
      implementationStatus: "implementiert",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((feature) => feature.area === "aufgaben" && feature.implementationStatus === "implementiert")).toBe(true);
  });

  it("filtert Funktionen ohne Test", () => {
    const result = filterFeatures(catalogFeatures, { ...EMPTY_FILTERS, onlyWithoutTests: true });
    expect(result.every((feature) => !hasAnyTest(feature))).toBe(true);
  });

  it("sucht in ID, Name, Tabelle und RPC", () => {
    const feature = catalogFeatures.find((candidate) => candidate.rpcs.length > 0);
    expect(feature).toBeDefined();
    if (!feature) return;
    expect(matchesQuery(feature, feature.rpcs[0])).toBe(true);
    expect(matchesQuery(feature, feature.id)).toBe(true);
    expect(matchesQuery(feature, "garantiert-nicht-vorkommender-begriff")).toBe(false);
  });

  it("liefert bei widersprüchlichen Filtern eine leere Menge statt Fantasiedaten", () => {
    const result = filterFeatures(catalogFeatures, {
      ...EMPTY_FILTERS,
      documentation: "fehlend",
      query: "knowledge.ask",
    });
    expect(result).toEqual([]);
  });
});
