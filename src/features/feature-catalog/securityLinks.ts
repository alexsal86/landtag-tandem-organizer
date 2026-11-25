import tableFeatures from "./generated/table-features.json";

/** Kompakte, generierte Zuordnung Tabelle → Funktionen für Verweise aus dem Security-Cockpit. */
export interface TableFeatureRef {
  id: string;
  name: string;
  area: string;
}

const byTable = tableFeatures as unknown as Record<string, TableFeatureRef[]>;

export function featuresForTable(table: string): TableFeatureRef[] {
  return byTable[table] ?? [];
}

export function featureCatalogHref(featureId: string): string {
  return `/funktionskatalog?feature=${encodeURIComponent(featureId)}`;
}
