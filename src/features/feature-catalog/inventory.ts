import type {
  FeatureAreaDefinition,
  FeatureDefinition,
  InventoryFile,
  ResolvedArea,
  ResolvedFeature,
} from "./types";

import arbeitsbereich from "./inventory/arbeitsbereich.json";
import aufgaben from "./inventory/aufgaben.json";
import automation from "./inventory/automation.json";
import dokumente from "./inventory/dokumente.json";
import entscheidungen from "./inventory/entscheidungen.json";
import kontakte from "./inventory/kontakte.json";
import kommunikation from "./inventory/kommunikation.json";
import mitarbeit from "./inventory/mitarbeit.json";
import organisation from "./inventory/organisation.json";
import schnittstellen from "./inventory/schnittstellen.json";
import termine from "./inventory/termine.json";
import veranstaltungen from "./inventory/veranstaltungen.json";
import verwaltung from "./inventory/verwaltung.json";
import vorgaenge from "./inventory/vorgaenge.json";
import wahl from "./inventory/wahl.json";
import wissen from "./inventory/wissen.json";

/**
 * Der zentrale Funktionskatalog.
 *
 * Quelle ist ausschließlich `inventory/*.json`. Die JSON-Dateien werden von
 * `npm run check:feature-catalog` gegen Quellcode, Datenbanktypen, Szenarien und
 * Testdateien geprüft. Hier findet keine zweite Pflege statt.
 */
export const inventoryFiles = [
  arbeitsbereich,
  aufgaben,
  vorgaenge,
  termine,
  veranstaltungen,
  entscheidungen,
  dokumente,
  wissen,
  kontakte,
  mitarbeit,
  organisation,
  kommunikation,
  wahl,
  automation,
  schnittstellen,
  verwaltung,
] as unknown as InventoryFile[];

const list = <T,>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);

export function resolveFeature(feature: FeatureDefinition): ResolvedFeature {
  return {
    ...feature,
    routes: list(feature.routes),
    components: list(feature.components),
    services: list(feature.services),
    hooks: list(feature.hooks),
    edgeFunctions: list(feature.edgeFunctions),
    rpcs: list(feature.rpcs),
    tables: list(feature.tables),
    roles: list(feature.roles),
    dependsOn: list(feature.dependsOn),
    scenarios: list(feature.scenarios),
    unitTests: list(feature.unitTests),
    integrationTests: list(feature.integrationTests),
    e2eTests: list(feature.e2eTests),
    docs: list(feature.docs),
    limitations: list(feature.limitations),
    reviewPoints: list(feature.reviewPoints),
  };
}

export const catalogFeatures: ResolvedFeature[] = inventoryFiles
  .flatMap((file) => file.features.map((feature) => resolveFeature({ ...feature, area: file.area.id })));

export const catalogAreas: ResolvedArea[] = inventoryFiles
  .map((file) => {
    const features = catalogFeatures.filter((feature) => feature.area === file.area.id);
    return {
      ...file.area,
      features,
      subareas: [...new Set(features.map((feature) => feature.subarea))],
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, "de"));

export const areaById = new Map<string, ResolvedArea>(catalogAreas.map((area) => [area.id, area]));
export const featureById = new Map<string, ResolvedFeature>(catalogFeatures.map((feature) => [feature.id, feature]));

export const areaDefinition = (id: string): FeatureAreaDefinition | undefined => areaById.get(id);
