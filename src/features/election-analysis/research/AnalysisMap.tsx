import { boundaryDifferencePath } from "./boundaryOverlay";
import { isReconstructedBoundary, reconstructedGeometryAttribution, historical1952SourceByTechnical } from "@/utils/electoralGeometryCatalog";
import { HistoricalGeometryNotice } from "@/features/election-history/HistoricalGeometryNotice";
import { ELECTORAL_TOPOLOGY_VERSION } from "@/utils/electoralTopologyAsset";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import * as L from "leaflet";
import { Plus, Minus, MoveDiagonal } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "@/styles/leaflet-overrides.css";
import { normalizeElectoralGeoJson } from "@/utils/geoJsonLoader";
import { electoralGeometryYear, loadElectoralTopology } from "@/utils/electoralTopology";
import { useGeography } from "./hooks";
import type { DistrictVersion } from "./types";
import { signedColor } from "./mapModel";

export function AnalysisMap({
  versions,
  values,
  label,
  onOpenDistrict,
  scaleMax,
  selectedDistrict,
  visibleDistricts,
  referenceValue,
  referenceLabel = "Landes-Swing",
  allowGeometryPreview = false,
  geometryYear,
  comparisonVersions,
  comparisonYear,
}: {
  versions: DistrictVersion[];
  values: Map<number, number | null>;
  label: string;
  onOpenDistrict: (district: number) => void;
  scaleMax?: number;
  selectedDistrict?: number | null;
  visibleDistricts?: Set<number>;
  referenceValue?: number | null;
  referenceLabel?: string;
  allowGeometryPreview?: boolean;
  geometryYear?: number;
  comparisonVersions?: DistrictVersion[];
  comparisonYear?: number;
}) {
  const geographyId =
    versions.find((v) => v.geography_id)?.geography_id || undefined;
  const geography = useGeography(geographyId);
  const confirmedBundledYear = versions.find(v => v.bundled_geometry_year)?.bundled_geometry_year;
  const preview = !confirmedBundledYear && allowGeometryPreview && !geography.isLoading &&
    (!geography.data?.asset_path || geography.data?.verified !== true);
  const selectedYear = geometryYear ?? versions[0]?.year;
  const bundledYear = confirmedBundledYear ?? (preview && selectedYear !== undefined ? electoralGeometryYear(selectedYear) : null);
  const asset = bundledYear
    ? `bundled:${bundledYear}`
    : preview
    ? "bundled:2021"
    : geography.data?.asset_path;
  const geometry = useQuery({
    queryKey: ["election-research", "geometry", geographyId, asset, ELECTORAL_TOPOLOGY_VERSION],
    enabled: !!asset && (!!confirmedBundledYear || preview || geography.data?.verified === true),
    queryFn: async ({ signal }) => {
      if (bundledYear || preview) return loadElectoralTopology(bundledYear ?? 2021);
      if (!asset || !asset.startsWith("/data/") || asset.includes(".."))
        throw new Error("Ungültiger Geometriepfad");
      const response = await fetch(asset, { signal });
      if (!response.ok) throw new Error("Geometrie nicht verfügbar");
      return normalizeElectoralGeoJson(await response.json());
    },
    staleTime: Infinity,
    gcTime: 600_000,
    retry: false,
  });
  // Only explicitly confirmed assignments authorize a spatial comparison.
  const comparisonBundledYear = comparisonVersions?.find(v => v.bundled_geometry_year)?.bundled_geometry_year;
  const comparisonGeometry = useQuery({
    queryKey: ["election-research", "boundary-overlay", comparisonBundledYear, ELECTORAL_TOPOLOGY_VERSION],
    enabled: comparisonBundledYear != null && confirmedBundledYear != null && !preview,
    queryFn: () => loadElectoralTopology(comparisonBundledYear!),
    staleTime: Infinity,
    gcTime: 600_000,
    retry: false,
  });
  const changedShapes = new Map<number, GeoJSON.Feature<GeoJSON.MultiPolygon>>();
  if (!preview && confirmedBundledYear && comparisonBundledYear && comparisonGeometry.data && geometry.data) {
    for (const feature of geometry.data.features) {
      const number = Number(feature.properties.Nummer);
      const before = comparisonVersions?.find(v => v.district_number === number);
      const after = versions.find(v => v.district_number === number);
      const old = comparisonGeometry.data.features.find(f => Number(f.properties.Nummer) === number);
      if (!old || !before?.identity_key || !after?.identity_key
        || before.identity_key === after.identity_key
        || before.bundled_geometry_year !== comparisonBundledYear
        || after.bundled_geometry_year !== confirmedBundledYear) continue;
      // SVG's even-odd rule draws the symmetric difference exactly: the shared
      // interior cancels, including holes. No rounding or area-based vote estimate.
      changedShapes.set(number, { type: "Feature", properties: { Nummer: number },
        geometry: boundaryDifferencePath(old.geometry, feature.geometry) });
    }
  }
  const element = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const bounds = useRef<L.LatLngBounds | null>(null);
  const onSelect = useRef(onOpenDistrict);
  useEffect(() => {
    onSelect.current = onOpenDistrict;
  }, [onOpenDistrict]);
  const paths = useRef(new Map<number, L.Path>());
  const overlays = useRef(new Map<number, L.GeoJSON[]>());
  const maximum =
    scaleMax ??
    Math.max(
      1,
      ...[...values.values()]
        .filter((v): v is number => v !== null)
        .map(Math.abs),
    );
  useEffect(() => {
    if (!element.current || !geometry.data) return;
    const instance = L.map(element.current, {
      zoomControl: false,
      attributionControl: true,
      keyboard: true,
      zoomSnap: 0.1,
    });
    map.current = instance;
    instance.attributionControl.addAttribution(
      bundledYear != null && isReconstructedBoundary(bundledYear)
        ? reconstructedGeometryAttribution(bundledYear)!
        : preview
        ? `Geometrie: Wahlkreisgrenzen ${bundledYear ?? 2021} · Zuordnung ungeprüft`
        : "Geometrie: Statistisches Landesamt Baden-Württemberg",
    );
    paths.current.clear();
    overlays.current.clear();
    const changePane = instance.createPane("boundaryChanges");
    changePane.style.zIndex = "450";
    changePane.style.pointerEvents = "none";
    const patternId = `analysis-unknown-${L.Util.stamp(instance)}`;
    const applyUnknownPattern = (path: L.Path) => {
      const node = path.getElement();
      if (!node) return;
      if (
        node instanceof SVGElement &&
        node.ownerSVGElement
      ) {
        const svg = node.ownerSVGElement;
        const patternId = `analysis-unknown-${L.Util.stamp(instance)}-${L.Util.stamp(svg)}`;
        if (!svg.querySelector(`#${patternId}`)) {
          const ns = "http://www.w3.org/2000/svg";
          const defs = document.createElementNS(ns, "defs");
          const pattern = document.createElementNS(ns, "pattern");
          pattern.id = patternId;
          pattern.setAttribute("width", "8");
          pattern.setAttribute("height", "8");
          pattern.setAttribute("patternUnits", "userSpaceOnUse");
          pattern.setAttribute("patternTransform", "rotate(45)");
          const background = document.createElementNS(ns, "rect");
          background.setAttribute("width", "8");
          background.setAttribute("height", "8");
          background.setAttribute("fill", "#e5e7eb");
          const stripe = document.createElementNS(ns, "path");
          stripe.setAttribute("d", "M0 0V8");
          stripe.setAttribute("stroke", "#6b7280");
          stripe.setAttribute("stroke-width", "3");
          pattern.append(background, stripe);
          defs.append(pattern);
          svg.prepend(defs);
        }
        node.setAttribute("fill", `url(#${patternId})`);
      }
    };
    const layer = L.geoJSON(geometry.data as GeoJSON.FeatureCollection, {
      style: (feature) => {
        const properties = feature?.properties || {};
        const number = Number(
          properties.Nummer ??
            properties.WKR_NR ??
            properties.WKRNR ??
            properties.NR,
        );
        const version = versions.find((v) => v.district_number === number);
        const value =
          bundledYear !== 1952 && !preview && (confirmedBundledYear ? version?.bundled_geometry_year === confirmedBundledYear : version?.geography_id === geographyId)
            ? (values.get(number) ?? null)
            : null;
        return {
          color: "#fff",
          weight: 1.2,
          fillColor:
            changedShapes.has(number) ? "#d1d5db" : value === null ? `url(#${patternId})` : signedColor(value, maximum),
          fillOpacity: 0.85,
        };
      },
      onEachFeature: (feature, path) => {
        const p = feature.properties || {};
        const number = Number(p.Nummer ?? p.WKR_NR ?? p.WKRNR ?? p.NR);
        if (bundledYear === 1952) {
          path.on('add', () => applyUnknownPattern(path as L.Path));
          const source = historical1952SourceByTechnical(number);
          if (source) {
            const tooltip = document.createElement('span');
            tooltip.textContent = `${source.label}: ${source.name} · Rekonstruktion; keine automatische Ergebniszuordnung`;
            path.bindTooltip(tooltip, { sticky: true });
          }
          return;
        }
        const version = versions.find((v) => v.district_number === number);
        if (!version) return;
        const value =
          bundledYear !== 1952 && !preview && (confirmedBundledYear ? version.bundled_geometry_year === confirmedBundledYear : version.geography_id === geographyId)
            ? (values.get(number) ?? null)
            : null;
        const tooltip = document.createElement("span");
        tooltip.textContent = `${number}: ${version.district_name} · ${preview ? "Zuordnung nach Wahlkreisnummer ungeprüft · " : ""}${changedShapes.has(number) ? "Grenzen verändert · gemeinsame Fläche ohne berechenbaren Swing · schraffiert: hinzugekommen oder weggefallen" : value === null ? "nicht vergleichbar / unbekannt" : `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${label}`}`;
        paths.current.set(number, path as L.Path);
        path.bindTooltip(tooltip, { sticky: true });
        path.on("click", () => onSelect.current(number));
        path.on("add", () => {
          const node = (path as L.Path).getElement();
          if (!node) return;
          if (value === null && !changedShapes.has(number)) applyUnknownPattern(path as L.Path);
          node.setAttribute("tabindex", "0");
          node.setAttribute("role", "button");
          node.setAttribute(
            "aria-label",
            tooltip.textContent || version.district_name,
          );
          node.addEventListener("keydown", (event) => {
            if (
              event instanceof KeyboardEvent &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              event.stopPropagation();
              onSelect.current(number);
            }
          });
        });
      },
    }).addTo(instance);
    const displayBounds = layer.getBounds();
    if (changedShapes.size) {
      for (const [number, feature] of changedShapes) {
        const overlay = L.geoJSON(feature, {
          interactive: false,
          pane: "boundaryChanges",
          // @ts-expect-error Leaflet supports smoothFactor at runtime, but @types/leaflet omits it from PathOptions.
          style: { smoothFactor: 0, stroke: false, fillColor: `url(#${patternId})`, fillOpacity: 0.85, fillRule: "evenodd" },
        }).addTo(instance);
        overlay.eachLayer(path => applyUnknownPattern(path as L.Path));
        const old = comparisonGeometry.data!.features.find(f => Number(f.properties.Nummer) === number)!;
        const outline = L.geoJSON(old as GeoJSON.Feature, {
          interactive: false,
          pane: "boundaryChanges",
          // @ts-expect-error Leaflet supports smoothFactor at runtime, but @types/leaflet omits it from PathOptions.
          style: { smoothFactor: 0, color: "#4b5563", weight: 1, dashArray: "4 4", fill: false },
        }).addTo(instance);
        overlays.current.set(number, [overlay, outline]);
        // Keep departed areas within the reset/initial map extent.
        displayBounds.extend(overlay.getBounds());
      }
    }
    bounds.current = displayBounds;
    if (bounds.current.isValid())
      instance.fitBounds(bounds.current, { padding: [28, 28] });
    const observer = new ResizeObserver(() =>
      instance.invalidateSize({ pan: false }),
    );
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, [geometry.data, versions, values, label, geographyId, maximum, preview, bundledYear, confirmedBundledYear, comparisonGeometry.data, comparisonVersions, comparisonBundledYear]);
  useEffect(() => {
    paths.current.forEach((path, number) => {
      const selected = selectedDistrict === number;
      const visible = !visibleDistricts || visibleDistricts.has(number);
      path.setStyle({
        color: selected ? "#111827" : "#fff",
        weight: selected ? 3 : 1.2,
        opacity: visible || selected ? 1 : 0.25,
        fillOpacity: visible || selected ? 0.85 : 0.2,
      });
      path.getElement()?.setAttribute("aria-pressed", String(selected));
      if (selected) path.bringToFront();
      overlays.current.get(number)?.forEach(layer => layer.setStyle({
        opacity: visible || selected ? 1 : 0.25,
        fillOpacity: visible || selected ? 0.85 : 0.2,
      }));
    });
  }, [
    selectedDistrict,
    visibleDistricts,
    geometry.data,
    versions,
    values,
    label,
    geographyId,
    maximum,
    comparisonGeometry.data,
    comparisonVersions,
    comparisonBundledYear,
  ]);
  if (geography.isLoading || geometry.isLoading)
    return (
      <p role="status" className="text-sm">
        Wahlkreisgeometrie lädt …
      </p>
    );
  if (!asset || (!confirmedBundledYear && !preview && geography.error) || geometry.error)
    return (
      <p className="rounded-lg border p-3 text-sm text-muted-foreground">
        Für diese Auswahl ist noch keine geprüfte Geometrie verfügbar. Die
        Tabelle bleibt nutzbar; heutige Grenzen werden nicht ungeprüft
        eingesetzt.
      </p>
    );
  return (
    <div className="space-y-2">
      <HistoricalGeometryNotice year={bundledYear} />
      {comparisonYear != null && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm">
          Grenzvergleich {comparisonYear} → {geometryYear}: Bei bestätigten, veränderten
          Wahlkreisgrenzen sind nur hinzugekommene oder weggefallene Teilflächen schraffiert.
          Die gestrichelte Linie zeigt die frühere Grenze. Gemeinsame Flächen bleiben grau:
          Aus Gesamtergebnissen unterschiedlicher Zuschnitte lässt sich auch für diese
          Teilflächen kein exakter Swing berechnen. Unveränderte, bestätigte Wahlkreise
          erhalten bei verfügbaren Vergleichswerten die Swing-Farbe. Eine vollständige
          Schraffur bedeutet fehlende Daten oder ungeprüfte Zuordnung. Kleine Unterschiede
          können auch aus der Digitalisierung stammen; Flächenanteile werden nicht in Stimmen umgerechnet.
        </p>
      )}
      {comparisonYear != null && comparisonGeometry.isLoading && <p role="status" className="text-sm">Frühere Wahlkreisgrenzen laden …</p>}
      {comparisonYear != null && comparisonGeometry.error && <p role="status" className="text-sm">Der frühere Grenzstand konnte nicht geladen werden. Die Teilflächenmarkierung ist deshalb nicht verfügbar.</p>}
      {preview && (
        <p role="status" className="rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          Ungeprüfte Kartenvorschau: Angezeigt werden die vorhandenen
          Wahlkreisgrenzen von {bundledYear ?? 2021}. Ihre Übereinstimmung mit den ausgewählten
          Wahljahren und die Zuordnung nach Wahlkreisnummer müssen noch geprüft
          werden. Die Flächen bleiben deshalb schraffiert; Ergebnisse stehen
          weiterhin in der Tabelle und im Wahlkreisdetail zur Verfügung.
        </p>
      )}
      <div className="bw-election-map relative h-[380px] md:h-[520px] rounded-lg overflow-hidden border bg-[#e6eadf]">
        <div
          ref={element}
          className="h-full w-full"
          role="region"
          aria-label={`Wahlkreiskarte: ${label}`}
        />
        <div className="absolute left-3 top-3 z-[1000] flex flex-col gap-2">
          <button
            className="bw-map-control"
            aria-label="Vergrößern"
            onClick={() => map.current?.zoomIn()}
          >
            <Plus size={16} />
          </button>
          <button
            className="bw-map-control"
            aria-label="Verkleinern"
            onClick={() => map.current?.zoomOut()}
          >
            <Minus size={16} />
          </button>
          <button
            className="bw-map-control mt-1"
            aria-label="Gesamtansicht"
            onClick={() => {
              if (bounds.current)
                map.current?.fitBounds(bounds.current, { padding: [28, 28] });
            }}
          >
            <MoveDiagonal size={16} />
          </button>
        </div>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div
          className="relative h-3 rounded bg-[linear-gradient(90deg,#c26b28,#f0f1eb,#2563a6)]"
          aria-label={`Farbskala von minus ${maximum} bis plus ${maximum} ${label}`}
        >
          {referenceValue != null && (
            <span
              className="absolute -top-1 h-5 w-0.5 bg-foreground"
              style={{
                left: `calc(${Math.max(0, Math.min(100, 50 + (referenceValue / maximum) * 50))}% - 1px)`,
              }}
              title={`${referenceLabel}: ${referenceValue.toLocaleString("de-DE")} ${label}`}
            />
          )}
        </div>
        <div className="flex justify-between tabular-nums">
          <span>
            −{maximum.toLocaleString("de-DE", { maximumFractionDigits: 2 })}
          </span>
          <span>0</span>
          <span>
            +{maximum.toLocaleString("de-DE", { maximumFractionDigits: 2 })}{" "}
            {label}
          </span>
        </div>
        {referenceValue != null && (
          <p>
            {referenceLabel}: {referenceValue > 0 ? "+" : ""}
            {referenceValue.toLocaleString("de-DE", {
              maximumFractionDigits: 2,
            })}{" "}
            {label}
            {Math.abs(referenceValue) > maximum
              ? " (außerhalb der Farbskala)"
              : ""}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>🟠 negative Veränderung</span>
        <span>hell: nahe null</span>
        <span>🔵 positive Veränderung</span>
        <span>
          <span
            className="mr-1 inline-block h-3 w-3 border align-middle"
            style={{
              background:
                "repeating-linear-gradient(45deg,#e5e7eb 0 4px,#6b7280 4px 6px)",
            }}
          />
          schraffiert: Grenzänderung; sonst unbekannt / ausgeschlossen
        </span>
      </div>
      {bundledYear != null && isReconstructedBoundary(bundledYear) ? <p className="text-xs text-muted-foreground">Rekonstruierte Kartengrundlage {bundledYear} · historische Zuordnung separat prüfen</p> : preview ? (
        <p className="text-xs text-muted-foreground">
          Kartengrundlage: Wahlkreisgrenzen {bundledYear ?? 2021} · Prüfung für diese Auswahl ausstehend
        </p>
      ) : <a
        className="text-xs underline"
        href={confirmedBundledYear ? "https://www.statistik-bw.de/Wahlen/Landtag/" : geography.data?.source_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Amtliche Geometrie · {confirmedBundledYear ?? geography.data?.year}
      </a>}
    </div>
  );
}
