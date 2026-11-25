import type { FeatureAreaDefinition, ResolvedFeature } from "./types";

/**
 * Abgeleitete Funktionslandkarte.
 *
 * Alle Knoten und Kanten entstehen ausschließlich aus dem versionierten Funktionsbestand
 * (`inventory/*.json`). Es gibt keine zweite, handgepflegte Kartendatei: Änderungen an
 * Bereich, Unterbereich oder `dependsOn` verändern die Karte automatisch.
 *
 * Die Karte behauptet keine Laufzeitaufrufe und keine Datenflüsse. Kanten sind deklarierte
 * Abhängigkeiten; Statusangaben bleiben getrennt von Testaussagen.
 */

const INACTIVE_STATUSES = new Set(["deaktiviert", "veraltet", "entfernt", "verwaist", "unklar"]);

export interface MapSubarea {
  name: string;
  features: number;
}

/** Kopplung eines Bereichs zu einem anderen Bereich, in eine Richtung. */
export interface MapCoupling {
  area: string;
  weight: number;
}

export interface MapAreaNode {
  id: string;
  title: string;
  purpose: string;
  features: number;
  implemented: number;
  partial: number;
  inactive: number;
  withoutTest: number;
  subareas: MapSubarea[];
  /** Bereiche, von denen Funktionen dieses Bereichs abhängen. */
  outgoing: MapCoupling[];
  /** Bereiche, die auf Funktionen dieses Bereichs verweisen. */
  incoming: MapCoupling[];
}

/** Deklarierte Abhängigkeit zwischen zwei Funktionsbereichen. */
export interface MapLink {
  from: string;
  to: string;
  weight: number;
  features: string[];
}

/** Kette aus deklarierten Abhängigkeiten (Funktion hängt ab von …). */
export interface MapChain {
  ids: string[];
  areas: string[];
}

export interface FeatureMapModel {
  nodes: MapAreaNode[];
  links: MapLink[];
  chains: MapChain[];
  declaredDependencies: number;
  featuresWithoutDependency: number;
}

const hasTest = (feature: ResolvedFeature): boolean =>
  feature.scenarios.length + feature.unitTests.length + feature.integrationTests.length + feature.e2eTests.length > 0;

export function buildAreaNodes(
  features: readonly ResolvedFeature[],
  areas: readonly FeatureAreaDefinition[],
): MapAreaNode[] {
  return areas
    .map((area) => {
      const own = features.filter((feature) => feature.area === area.id);
      const subareas = new Map<string, number>();
      for (const feature of own) subareas.set(feature.subarea, (subareas.get(feature.subarea) ?? 0) + 1);
      return {
        id: area.id,
        title: area.title,
        purpose: area.purpose,
        features: own.length,
        implemented: own.filter((feature) => feature.implementationStatus === "implementiert").length,
        partial: own.filter((feature) => feature.implementationStatus === "teilweise").length,
        inactive: own.filter((feature) => INACTIVE_STATUSES.has(feature.implementationStatus)).length,
        withoutTest: own.filter((feature) => !hasTest(feature)).length,
        subareas: [...subareas.entries()]
          .map(([name, count]) => ({ name, features: count }))
          .sort((a, b) => b.features - a.features || a.name.localeCompare(b.name, "de")),
        outgoing: [],
        incoming: [],
      };
    })
    .filter((node) => node.features > 0)
    .sort((a, b) => b.features - a.features || a.title.localeCompare(b.title, "de"));
}

export function buildAreaLinks(features: readonly ResolvedFeature[]): MapLink[] {
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const links = new Map<string, MapLink>();
  for (const feature of features) {
    for (const dependency of feature.dependsOn) {
      const target = byId.get(dependency);
      if (!target || target.area === feature.area) continue;
      const key = `${feature.area}->${target.area}`;
      const existing = links.get(key);
      if (existing) {
        existing.weight += 1;
        existing.features.push(feature.id);
      } else {
        links.set(key, { from: feature.area, to: target.area, weight: 1, features: [feature.id] });
      }
    }
  }
  return [...links.values()].sort(
    (a, b) => b.weight - a.weight || a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
  );
}

/**
 * Längste deklarierte Abhängigkeitsketten. Zyklen werden erkannt und abgeschnitten,
 * damit die Anzeige auch bei fehlerhaften Katalogeinträgen nicht hängt.
 */
export interface ChainOptions {
  limit?: number;
  /** Mindestlänge der Kette. Kurze Paare wiederholen nur die Bereichskopplungen. */
  minLength?: number;
}

export function buildDependencyChains(
  features: readonly ResolvedFeature[],
  { limit = 5, minLength = 3 }: ChainOptions = {},
): MapChain[] {
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const longest = new Map<string, string[]>();

  const walk = (id: string, visiting: Set<string>): string[] => {
    const cached = longest.get(id);
    if (cached) return cached;
    // Zyklus: den Rückweg abschneiden, statt die Ausgangsfunktion erneut anzuhängen.
    if (visiting.has(id)) return [];
    const feature = byId.get(id);
    if (!feature) return [];
    visiting.add(id);
    let best: string[] = [];
    for (const dependency of feature.dependsOn) {
      if (!byId.has(dependency)) continue;
      const candidate = walk(dependency, visiting);
      if (candidate.length > best.length) best = candidate;
    }
    visiting.delete(id);
    const chain = [id, ...best];
    longest.set(id, chain);
    return chain;
  };

  const chains = features.map((feature) => walk(feature.id, new Set<string>()));
  const unique = new Map<string, MapChain>();
  for (const ids of chains) {
    if (ids.length < minLength) continue;
    unique.set(ids.join(">"), {
      ids,
      areas: ids.map((id) => byId.get(id)?.area ?? ""),
    });
  }
  const sorted = [...unique.values()].sort(
    (a, b) => b.ids.length - a.ids.length || a.ids.join(">").localeCompare(b.ids.join(">")),
  );
  const selected: MapChain[] = [];
  for (const chain of sorted) {
    if (selected.some((existing) => containsContiguous(existing.ids, chain.ids))) continue;
    selected.push(chain);
    if (selected.length >= limit) break;
  }
  return selected;
}

/** Prüft, ob `inner` als zusammenhängende Folge in `outer` enthalten ist (ohne Teilstring-Fehler). */
function containsContiguous(outer: readonly string[], inner: readonly string[]): boolean {
  if (inner.length === 0 || inner.length > outer.length) return false;
  for (let start = 0; start + inner.length <= outer.length; start += 1) {
    if (inner.every((id, offset) => outer[start + offset] === id)) return true;
  }
  return false;
}

export function buildFeatureMap(
  features: readonly ResolvedFeature[],
  areas: readonly FeatureAreaDefinition[],
): FeatureMapModel {
  const referenced = new Set<string>();
  for (const feature of features) {
    for (const dependency of feature.dependsOn) referenced.add(feature.id).add(dependency);
  }
  const links = buildAreaLinks(features);
  const nodes = buildAreaNodes(features, areas).map((node) => ({
    ...node,
    outgoing: links.filter((link) => link.from === node.id).map((link) => ({ area: link.to, weight: link.weight })),
    incoming: links.filter((link) => link.to === node.id).map((link) => ({ area: link.from, weight: link.weight })),
  }));
  return {
    nodes,
    links,
    chains: buildDependencyChains(features),
    declaredDependencies: features.reduce((sum, feature) => sum + feature.dependsOn.length, 0),
    featuresWithoutDependency: features.filter((feature) => !referenced.has(feature.id)).length,
  };
}
