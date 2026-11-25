import { describe, expect, it } from "vitest";
import { buildAreaLinks, buildAreaNodes, buildDependencyChains, buildFeatureMap } from "./map";
import { resolveFeature } from "./inventory";
import type { FeatureAreaDefinition, FeatureDefinition } from "./types";

const area = (id: string, title = id): FeatureAreaDefinition => ({ id, title, purpose: `${title} Zweck` });

const feature = (input: Partial<FeatureDefinition> & Pick<FeatureDefinition, "id" | "area">): FeatureDefinition => ({
  subarea: "Allgemein",
  name: input.id,
  description: "Beschreibung",
  category: "fachlich",
  implementationStatus: "implementiert",
  integrationStatus: "ui",
  coverage: "keine",
  testResult: "nicht-ausgefuehrt",
  evidence: ["src/features/feature-catalog/map.ts"],
  unitTests: [],
  ...input,
});

const resolved = (input: Parameters<typeof feature>[0]) => resolveFeature(feature(input));

describe("Funktionslandkarte", () => {
  it("zählt Funktionen und Status je Bereich und sortiert nach Größe", () => {
    const nodes = buildAreaNodes(
      [
        resolved({ id: "a.one", area: "a" }),
        resolved({ id: "a.two", area: "a", subarea: "Spezial", implementationStatus: "teilweise" }),
        resolved({ id: "b.one", area: "b", implementationStatus: "verwaist" }),
      ],
      [area("a", "Alpha"), area("b", "Beta")],
    );

    expect(nodes.map((node) => node.id)).toEqual(["a", "b"]);
    expect(nodes[0]).toMatchObject({ features: 2, implemented: 1, partial: 1, inactive: 0, withoutTest: 2 });
    expect(nodes[0].subareas).toEqual([
      { name: "Allgemein", features: 1 },
      { name: "Spezial", features: 1 },
    ]);
    expect(nodes[1].inactive).toBe(1);
  });

  it("blendet Bereiche ohne passende Funktionen aus, statt leere Knoten zu zeigen", () => {
    const nodes = buildAreaNodes([resolved({ id: "a.one", area: "a" })], [area("a"), area("leer")]);
    expect(nodes.map((node) => node.id)).toEqual(["a"]);
  });

  it("leitet Bereichskopplungen nur aus bereichsübergreifenden Abhängigkeiten ab", () => {
    const links = buildAreaLinks([
      resolved({ id: "a.one", area: "a", dependsOn: ["b.one", "a.two"] }),
      resolved({ id: "a.two", area: "a" }),
      resolved({ id: "b.one", area: "b" }),
      resolved({ id: "b.two", area: "b", dependsOn: ["a.one"] }),
      resolved({ id: "c.one", area: "c", dependsOn: ["a.one"] }),
    ]);

    expect(links.map((link) => `${link.from}->${link.to}:${link.weight}`).sort()).toEqual([
      "a->b:1",
      "b->a:1",
      "c->a:1",
    ]);
  });

  it("bildet die längste Abhängigkeitskette und schneidet Zyklen ab", () => {
    const chains = buildDependencyChains([
      resolved({ id: "a", area: "a", dependsOn: ["b"] }),
      resolved({ id: "b", area: "b", dependsOn: ["c"] }),
      resolved({ id: "c", area: "c", dependsOn: ["a"] }),
    ]);

    expect(chains).toHaveLength(1);
    expect(chains[0].ids).toEqual(["a", "b", "c"]);
    expect(new Set(chains[0].ids).size).toBe(chains[0].ids.length);
  });

  it("behält die längste Kette und verwirft enthaltene Teilstücke", () => {
    const chains = buildDependencyChains([
      resolved({ id: "a", area: "a", dependsOn: ["b"] }),
      resolved({ id: "b", area: "b", dependsOn: ["c"] }),
      resolved({ id: "c", area: "c" }),
      resolved({ id: "d", area: "d", dependsOn: ["c"] }),
    ]);

    expect(chains[0].ids).toEqual(["a", "b", "c"]);
    expect(chains.map((chain) => chain.ids.join(">"))).not.toContain("b>c");
  });

  it("zeigt standardmäßig keine Paare als Wirkungskette, da sie nur Kopplungen wiederholen", () => {
    const features = [
      resolved({ id: "a", area: "a", dependsOn: ["b"] }),
      resolved({ id: "b", area: "b" }),
    ];

    expect(buildDependencyChains(features)).toEqual([]);
    expect(buildDependencyChains(features, { minLength: 2 })[0].ids).toEqual(["a", "b"]);
  });

  it("meldet Funktionen ohne jeden Abhängigkeitsbezug und zählt Deklarationen", () => {
    const model = buildFeatureMap(
      [
        resolved({ id: "a", area: "a", dependsOn: ["b"] }),
        resolved({ id: "b", area: "b" }),
        resolved({ id: "c", area: "c" }),
      ],
      [area("a"), area("b"), area("c")],
    );

    expect(model.declaredDependencies).toBe(1);
    expect(model.featuresWithoutDependency).toBe(1);
    expect(model.chains).toEqual([]);
    expect(model.nodes.map((node) => node.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("hinterlegt die Kopplungen direkt am jeweiligen Bereichsknoten", () => {
    const model = buildFeatureMap(
      [
        resolved({ id: "a.one", area: "a", dependsOn: ["b.one"] }),
        resolved({ id: "b.one", area: "b" }),
      ],
      [area("a"), area("b")],
    );

    const a = model.nodes.find((node) => node.id === "a");
    const b = model.nodes.find((node) => node.id === "b");
    expect(a?.outgoing).toEqual([{ area: "b", weight: 1 }]);
    expect(a?.incoming).toEqual([]);
    expect(b?.incoming).toEqual([{ area: "a", weight: 1 }]);
    expect(b?.outgoing).toEqual([]);
  });
});
