/**
 * Datenmodell des zentralen Funktionskatalogs.
 *
 * Der Katalog beschreibt den tatsächlich im Quellcode vorhandenen Funktionsumfang.
 * Er ist keine Soll-Spezifikation: Implementierungsstatus, Einbindung, Testabdeckung
 * und Testergebnis sind getrennte Aussagen und dürfen nicht gegeneinander verrechnet werden.
 */

/** Fachliche Gruppierung einer Funktion. */
export type FeatureCategory =
  | "fachlich"
  | "administrativ"
  | "automatisiert"
  | "integration"
  | "sicherheit"
  | "technisch";

/** Implementierungsstatus im Quellcode. */
export type ImplementationStatus =
  | "implementiert"
  | "teilweise"
  | "deaktiviert"
  | "verwaist"
  | "veraltet"
  | "entfernt"
  | "unklar";

/** Wie die Funktion erreichbar ist – unabhängig davon, ob sie getestet ist. */
export type IntegrationStatus =
  | "ui"
  | "system"
  | "rollenabhaengig"
  | "feature-flag"
  | "ohne-einbindung"
  | "ungeprueft"
  | "nicht-anwendbar";

/** Deklarierte Testabdeckung. Ein vorhandener Test ist kein bestandener Test. */
export type TestCoverageStatus =
  | "selftest"
  | "unit"
  | "integration"
  | "browser"
  | "security"
  | "teilweise"
  | "keine"
  | "ungeprueft";

/** Letztes bekanntes Testergebnis – niemals aus der Existenz einer Testdatei abgeleitet. */
export type TestResultStatus =
  | "bestanden"
  | "fehlgeschlagen"
  | "nicht-ausgefuehrt"
  | "uebersprungen"
  | "voraussetzung-fehlt"
  | "veraltet"
  | "unbekannt";

export const FEATURE_CATEGORIES: readonly FeatureCategory[] = [
  "fachlich",
  "administrativ",
  "automatisiert",
  "integration",
  "sicherheit",
  "technisch",
];

export const IMPLEMENTATION_STATUSES: readonly ImplementationStatus[] = [
  "implementiert",
  "teilweise",
  "deaktiviert",
  "verwaist",
  "veraltet",
  "entfernt",
  "unklar",
];

export const INTEGRATION_STATUSES: readonly IntegrationStatus[] = [
  "ui",
  "system",
  "rollenabhaengig",
  "feature-flag",
  "ohne-einbindung",
  "ungeprueft",
  "nicht-anwendbar",
];

export const TEST_COVERAGE_STATUSES: readonly TestCoverageStatus[] = [
  "selftest",
  "unit",
  "integration",
  "browser",
  "security",
  "teilweise",
  "keine",
  "ungeprueft",
];

export const TEST_RESULT_STATUSES: readonly TestResultStatus[] = [
  "bestanden",
  "fehlgeschlagen",
  "nicht-ausgefuehrt",
  "uebersprungen",
  "voraussetzung-fehlt",
  "veraltet",
  "unbekannt",
];

/** Rollen, unter denen eine Funktion sichtbar oder wirksam ist. */
export type FeatureRole =
  | "abgeordneter"
  | "bueroleitung"
  | "mitarbeiter"
  | "admin"
  | "superadmin"
  | "oeffentlich"
  | "system";

export interface FeatureAreaDefinition {
  id: string;
  title: string;
  purpose: string;
}

export interface FeatureDefinition {
  /** Stabile, eindeutige ID, z. B. `tasks.create`. Bei Umbenennung beibehalten. */
  id: string;
  /** ID des Funktionsbereichs (`FeatureAreaDefinition.id`). */
  area: string;
  /** Unterbereich innerhalb des Funktionsbereichs. */
  subarea: string;
  name: string;
  description: string;
  category: FeatureCategory;
  implementationStatus: ImplementationStatus;
  integrationStatus: IntegrationStatus;
  coverage: TestCoverageStatus;
  testResult: TestResultStatus;
  /** Nachweise im Quellcode. Mindestens ein Pfad, der existieren muss. */
  evidence: string[];
  routes?: string[];
  components?: string[];
  services?: string[];
  hooks?: string[];
  edgeFunctions?: string[];
  rpcs?: string[];
  tables?: string[];
  roles?: FeatureRole[];
  dependsOn?: string[];
  scenarios?: string[];
  unitTests?: string[];
  integrationTests?: string[];
  e2eTests?: string[];
  docs?: string[];
  limitations?: string[];
  reviewPoints?: string[];
}

export interface InventoryFile {
  area: FeatureAreaDefinition;
  features: FeatureDefinition[];
}

/** Aufgelöste Funktion mit normalisierten (leeren) Listenfeldern. */
export interface ResolvedFeature extends FeatureDefinition {
  routes: string[];
  components: string[];
  services: string[];
  hooks: string[];
  edgeFunctions: string[];
  rpcs: string[];
  tables: string[];
  roles: FeatureRole[];
  dependsOn: string[];
  scenarios: string[];
  unitTests: string[];
  integrationTests: string[];
  e2eTests: string[];
  docs: string[];
  limitations: string[];
  reviewPoints: string[];
}

export interface ResolvedArea extends FeatureAreaDefinition {
  features: ResolvedFeature[];
  subareas: string[];
}

/** Ein aus dem Quellcode inventarisiertes technisches Objekt. */
export interface InventoriedObject {
  kind: "route" | "edge-function" | "rpc" | "scenario" | "navigation";
  key: string;
  /** Datei, in der das Objekt nachgewiesen ist. */
  source: string;
}

export interface CoverageMetrics {
  features: number;
  areas: number;
  subareas: number;
  implemented: number;
  partial: number;
  disabled: number;
  orphaned: number;
  reviewCandidates: number;
  withSelftest: number;
  withUnitTest: number;
  withIntegrationTest: number;
  withBrowserTest: number;
  withSecurityTest: number;
  withoutAnyTest: number;
  missingDocumentation: number;
  withLimitations: number;
  unverifiedIntegration: number;
  technicalAssignments: number;
}
