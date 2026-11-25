import type {
  CoverageMetrics,
  FeatureCategory,
  FeatureDefinition,
  FeatureRole,
  ImplementationStatus,
  IntegrationStatus,
  TestCoverageStatus,
} from "./types";
import {
  FEATURE_CATEGORIES,
  IMPLEMENTATION_STATUSES,
  INTEGRATION_STATUSES,
  TEST_COVERAGE_STATUSES,
  TEST_RESULT_STATUSES,
} from "./types";

export interface FeatureFilters {
  query: string;
  area: string;
  subarea: string;
  category: FeatureCategory | "";
  implementationStatus: ImplementationStatus | "";
  integrationStatus: IntegrationStatus | "";
  coverage: TestCoverageStatus | "";
  documentation: "" | "dokumentiert" | "fehlend";
  role: FeatureRole | "";
  onlyWithoutTests: boolean;
  onlyReviewCandidates: boolean;
}

export const EMPTY_FILTERS: FeatureFilters = {
  query: "",
  area: "",
  subarea: "",
  category: "",
  implementationStatus: "",
  integrationStatus: "",
  coverage: "",
  documentation: "",
  role: "",
  onlyWithoutTests: false,
  onlyReviewCandidates: false,
};

export const hasAnyTest = (feature: FeatureDefinition): boolean =>
  Boolean(
    feature.scenarios?.length ||
      feature.unitTests?.length ||
      feature.integrationTests?.length ||
      feature.e2eTests?.length,
  );

export const hasDocumentation = (feature: FeatureDefinition): boolean => Boolean(feature.docs?.length);

export const isReviewCandidate = (feature: FeatureDefinition): boolean =>
  Boolean(feature.reviewPoints?.length) || feature.implementationStatus === "unklar";

/** Direkte technische Zuordnungen einer Funktion (ohne Tabellen/Rollen). */
export const technicalReferences = (feature: FeatureDefinition): number =>
  (feature.routes?.length ?? 0) +
  (feature.components?.length ?? 0) +
  (feature.services?.length ?? 0) +
  (feature.hooks?.length ?? 0) +
  (feature.edgeFunctions?.length ?? 0) +
  (feature.rpcs?.length ?? 0);

export function computeMetrics(features: readonly FeatureDefinition[]): CoverageMetrics {
  const areas = new Set(features.map((feature) => feature.area));
  const subareas = new Set(features.map((feature) => `${feature.area}/${feature.subarea}`));
  return {
    features: features.length,
    areas: areas.size,
    subareas: subareas.size,
    implemented: features.filter((feature) => feature.implementationStatus === "implementiert").length,
    partial: features.filter((feature) => feature.implementationStatus === "teilweise").length,
    disabled: features.filter((feature) => feature.implementationStatus === "deaktiviert").length,
    orphaned: features.filter((feature) => feature.implementationStatus === "verwaist").length,
    reviewCandidates: features.filter(isReviewCandidate).length,
    withSelftest: features.filter((feature) => feature.scenarios?.length).length,
    withUnitTest: features.filter((feature) => feature.unitTests?.length).length,
    withIntegrationTest: features.filter((feature) => feature.integrationTests?.length).length,
    withBrowserTest: features.filter((feature) => feature.e2eTests?.length).length,
    withSecurityTest: features.filter((feature) => feature.coverage === "security").length,
    withoutAnyTest: features.filter((feature) => !hasAnyTest(feature)).length,
    missingDocumentation: features.filter((feature) => !hasDocumentation(feature)).length,
    withLimitations: features.filter((feature) => feature.limitations?.length).length,
    unverifiedIntegration: features.filter(
      (feature) => feature.integrationStatus === "ungeprueft" || feature.integrationStatus === "ohne-einbindung",
    ).length,
    technicalAssignments: features.reduce((sum, feature) => sum + technicalReferences(feature), 0),
  };
}

const normalize = (value: string) => value.toLocaleLowerCase("de").normalize("NFKD");

export function matchesQuery(feature: FeatureDefinition, query: string): boolean {
  const term = normalize(query.trim());
  if (!term) return true;
  const haystack = normalize(
    [
      feature.id,
      feature.name,
      feature.description,
      feature.subarea,
      feature.category,
      ...(feature.routes ?? []),
      ...(feature.tables ?? []),
      ...(feature.rpcs ?? []),
      ...(feature.edgeFunctions ?? []),
      ...(feature.roles ?? []),
    ].join(" "),
  );
  return haystack.includes(term);
}

export function filterFeatures<T extends FeatureDefinition>(
  features: readonly T[],
  filters: FeatureFilters,
): T[] {
  return features.filter((feature) => {
    if (filters.area && feature.area !== filters.area) return false;
    if (filters.subarea && feature.subarea !== filters.subarea) return false;
    if (filters.category && feature.category !== filters.category) return false;
    if (filters.implementationStatus && feature.implementationStatus !== filters.implementationStatus) return false;
    if (filters.integrationStatus && feature.integrationStatus !== filters.integrationStatus) return false;
    if (filters.coverage && feature.coverage !== filters.coverage) return false;
    if (filters.documentation === "dokumentiert" && !hasDocumentation(feature)) return false;
    if (filters.documentation === "fehlend" && hasDocumentation(feature)) return false;
    if (filters.role && !(feature.roles ?? []).includes(filters.role)) return false;
    if (filters.onlyWithoutTests && hasAnyTest(feature)) return false;
    if (filters.onlyReviewCandidates && !isReviewCandidate(feature)) return false;
    if (!matchesQuery(feature, filters.query)) return false;
    return true;
  });
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

/**
 * Strukturprüfung, die ohne TypeScript-Parser auskommt. Sie prüft nur, was aus den
 * Daten selbst entscheidbar ist; Quellcode-Referenzen prüft `scripts/build-feature-catalog.mjs`.
 */
export function validateFeatureSet(features: readonly FeatureDefinition[]): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const areas = new Set<string>();

  for (const feature of features) {
    const label = feature.id || "(ohne ID)";
    if (!feature.id) issues.push("Funktion ohne ID");
    else if (ids.has(feature.id)) issues.push(`Doppelte Funktions-ID: ${feature.id}`);
    ids.add(feature.id);

    for (const field of ["area", "subarea", "name", "description", "category", "implementationStatus", "integrationStatus", "coverage", "testResult"] as const) {
      if (!feature[field] || typeof feature[field] !== "string") issues.push(`${label}: Pflichtfeld ${field} fehlt`);
    }
    if (!isStringArray(feature.evidence) || feature.evidence.length === 0) {
      issues.push(`${label}: mindestens ein Quellcode-Nachweis erforderlich`);
    }
    if (feature.area) areas.add(feature.area);
    if (!FEATURE_CATEGORIES.includes(feature.category)) issues.push(`${label}: unbekannte Kategorie ${feature.category}`);
    if (!IMPLEMENTATION_STATUSES.includes(feature.implementationStatus)) {
      issues.push(`${label}: unbekannter Implementierungsstatus ${feature.implementationStatus}`);
    }
    if (!INTEGRATION_STATUSES.includes(feature.integrationStatus)) {
      issues.push(`${label}: unbekannter Einbindungsstatus ${feature.integrationStatus}`);
    }
    if (!TEST_COVERAGE_STATUSES.includes(feature.coverage)) issues.push(`${label}: unbekannter Testabdeckungsstatus ${feature.coverage}`);
    if (!TEST_RESULT_STATUSES.includes(feature.testResult)) issues.push(`${label}: unbekannter Testergebnisstatus ${feature.testResult}`);

    if (feature.coverage === "keine" && hasAnyTest(feature)) {
      issues.push(`${label}: Testabdeckung "keine", aber Tests sind zugeordnet`);
    }
    if (feature.coverage !== "keine" && feature.coverage !== "ungeprueft" && !hasAnyTest(feature)) {
      issues.push(`${label}: Testabdeckung "${feature.coverage}" ohne zugeordneten Test`);
    }
    for (const dependency of feature.dependsOn ?? []) {
      if (dependency === feature.id) issues.push(`${label}: Abhängigkeit auf sich selbst`);
    }
  }

  for (const feature of features) {
    for (const dependency of feature.dependsOn ?? []) {
      if (!ids.has(dependency) && dependency !== feature.id) {
        issues.push(`${feature.id}: unbekannte Abhängigkeit ${dependency}`);
      }
    }
  }

  for (const area of areas) {
    if (!features.some((feature) => feature.area === area)) issues.push(`Bereich ohne Funktion: ${area}`);
  }

  return issues;
}

