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
}: {
  versions: DistrictVersion[];
  values: Map<number, number | null>;
  label: string;
  onOpenDistrict: (district: number) => void;
}) {
  const geographyId =
    versions.find((v) => v.geography_id)?.geography_id || undefined;
  const geography = useGeography(geographyId);
  const asset = geography.data?.asset_path;
  const geometry = useQuery({
    queryKey: ["election-research", "geometry", geographyId, asset],
    enabled: !!asset && geography.data?.verified === true,
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
      "Geometrie: Statistisches Landesamt Baden-Württemberg",
    );
    const max = Math.max(
      1,
      ...[...values.values()]
        .filter((v): v is number => v !== null)
        .map(Math.abs),
    );
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
          version?.geography_id === geographyId
            ? (values.get(number) ?? null)
            : null;
        return {
          color: "#fff",
          weight: 1.2,
          fillColor: signedColor(value, max),
          fillOpacity: 0.85,
        };
      },
      onEachFeature: (feature, path) => {
        const p = feature.properties || {};
        const number = Number(p.Nummer ?? p.WKR_NR ?? p.WKRNR ?? p.NR);
        const version = versions.find((v) => v.district_number === number);
        if (!version) return;
        const value =
          version.geography_id === geographyId
            ? (values.get(number) ?? null)
            : null;
        const tooltip = document.createElement("span");
        tooltip.textContent = `${number}: ${version.district_name} · ${value === null ? "nicht vergleichbar / unbekannt" : `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${label}`}`;
        path.bindTooltip(tooltip, { sticky: true });
        path.on("click", () => onOpenDistrict(number));
        path.on("add", () => {
          const node = (path as L.Path).getElement();
          if (!node) return;
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
              onOpenDistrict(number);
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
  }, [geometry.data, versions, values, label, onOpenDistrict, geographyId]);
  if (geography.isLoading || geometry.isLoading)
    return (
      <p role="status" className="text-sm">
        Verifizierte Geometrie lädt …
      </p>
    );
  if (!asset || geography.error || geometry.error)
    return (
      <p className="rounded-lg border p-3 text-sm text-muted-foreground">
        Für diese Auswahl ist noch keine geprüfte Geometrie verfügbar. Die
        Tabelle bleibt nutzbar; heutige Grenzen werden nicht ungeprüft
        eingesetzt.
      </p>
    );
  return (
    <div className="space-y-2">
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
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>🟠 negative Veränderung</span>
        <span>hell: nahe null</span>
        <span>🔵 positive Veränderung</span>
        <span>grau: unbekannt / ausgeschlossen</span>
      </div>
      <a
        className="text-xs underline"
        href={geography.data?.source_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Amtliche Geometrie · {geography.data?.year}
      </a>
    </div>
  );
}
