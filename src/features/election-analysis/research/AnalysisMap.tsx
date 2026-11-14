import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import * as L from "leaflet";
import { Plus, Minus, MoveDiagonal } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "@/styles/leaflet-overrides.css";
import { normalizeElectoralGeoJson } from "@/utils/geoJsonLoader";
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
}) {
  const geographyId =
    versions.find((v) => v.geography_id)?.geography_id || undefined;
  const geography = useGeography(geographyId);
  const preview = allowGeometryPreview && !geography.isLoading &&
    (!geography.data?.asset_path || geography.data?.verified !== true);
  const asset = preview
    ? "/data/LTWahlkreise2021-BW.geojson"
    : geography.data?.asset_path;
  const geometry = useQuery({
    queryKey: ["election-research", "geometry", geographyId, asset],
    enabled: !!asset && (preview || geography.data?.verified === true),
    queryFn: async ({ signal }) => {
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
  const element = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const bounds = useRef<L.LatLngBounds | null>(null);
  const onSelect = useRef(onOpenDistrict);
  useEffect(() => {
    onSelect.current = onOpenDistrict;
  }, [onOpenDistrict]);
  const paths = useRef(new Map<number, L.Path>());
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
      preview
        ? "Geometrie: Wahlkreisgrenzen 2021 · Zuordnung ungeprüft"
        : "Geometrie: Statistisches Landesamt Baden-Württemberg",
    );
    paths.current.clear();
    const patternId = `analysis-unknown-${L.Util.stamp(instance)}`;
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
          !preview && version?.geography_id === geographyId
            ? (values.get(number) ?? null)
            : null;
        return {
          color: "#fff",
          weight: 1.2,
          fillColor:
            value === null ? `url(#${patternId})` : signedColor(value, maximum),
          fillOpacity: 0.85,
        };
      },
      onEachFeature: (feature, path) => {
        const p = feature.properties || {};
        const number = Number(p.Nummer ?? p.WKR_NR ?? p.WKRNR ?? p.NR);
        const version = versions.find((v) => v.district_number === number);
        if (!version) return;
        const value =
          !preview && version.geography_id === geographyId
            ? (values.get(number) ?? null)
            : null;
        const tooltip = document.createElement("span");
        tooltip.textContent = `${number}: ${version.district_name} · ${preview ? "Zuordnung nach Wahlkreisnummer ungeprüft · " : ""}${value === null ? "nicht vergleichbar / unbekannt" : `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${label}`}`;
        paths.current.set(number, path as L.Path);
        path.bindTooltip(tooltip, { sticky: true });
        path.on("click", () => onSelect.current(number));
        path.on("add", () => {
          const node = (path as L.Path).getElement();
          if (!node) return;
          if (
            value === null &&
            node instanceof SVGElement &&
            node.ownerSVGElement
          ) {
            const svg = node.ownerSVGElement;
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
    bounds.current = layer.getBounds();
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
  }, [geometry.data, versions, values, label, geographyId, maximum, preview]);
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
  ]);
  if (geography.isLoading || geometry.isLoading)
    return (
      <p role="status" className="text-sm">
        Wahlkreisgeometrie lädt …
      </p>
    );
  if (!asset || (!preview && geography.error) || geometry.error)
    return (
      <p className="rounded-lg border p-3 text-sm text-muted-foreground">
        Für diese Auswahl ist noch keine geprüfte Geometrie verfügbar. Die
        Tabelle bleibt nutzbar; heutige Grenzen werden nicht ungeprüft
        eingesetzt.
      </p>
    );
  return (
    <div className="space-y-2">
      {preview && (
        <p role="status" className="rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          Ungeprüfte Kartenvorschau: Angezeigt werden die vorhandenen
          Wahlkreisgrenzen von 2021. Ihre Übereinstimmung mit den ausgewählten
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
          schraffiert: unbekannt / ausgeschlossen
        </span>
      </div>
      {preview ? (
        <p className="text-xs text-muted-foreground">
          Kartengrundlage: Wahlkreisgrenzen 2021 · Prüfung für diese Auswahl ausstehend
        </p>
      ) : <a
        className="text-xs underline"
        href={geography.data?.source_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Amtliche Geometrie · {geography.data?.year}
      </a>}
    </div>
  );
}
