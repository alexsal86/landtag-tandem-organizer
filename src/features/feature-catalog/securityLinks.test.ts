import { describe, expect, it } from "vitest";
import { featureCatalogHref, featuresForTable } from "./securityLinks";

describe("Sicherheitsverknüpfung des Funktionskatalogs", () => {
  it("ordnet Tabellen den Funktionen zu", () => {
    const features = featuresForTable("event_plannings");
    expect(features.some((feature) => feature.id === "events.plan")).toBe(true);
    expect(features.every((feature) => feature.name.length > 0)).toBe(true);
  });

  it("liefert für unbekannte Tabellen eine leere Liste statt einer erfundenen Zuordnung", () => {
    expect(featuresForTable("tabelle_die_es_nicht_gibt")).toEqual([]);
  });

  it("kodiert Funktions-IDs im Deep-Link", () => {
    expect(featureCatalogHref("events.plan")).toBe("/administration?adminSection=superadmin&adminSubSection=feature-catalog&feature=events.plan");
  });
});
