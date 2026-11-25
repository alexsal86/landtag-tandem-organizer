import { useId, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ELECTORAL_TOPOLOGY_VERSION } from "@/utils/electoralTopologyAsset";
import { electoralGeometryYear, loadElectoralTopology } from "@/utils/electoralTopology";
import { ChartExport, type CitationInput } from "../ChartExport";
import type { DistrictVersion } from "./types";
import { districtCentroids, hexGridLayout, hexPolygon, type LooseFeature } from "./hexGrid";
import { signedColor } from "./mapModel";

const format = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;

/**
 * Schematic Wabenkarte (kartogramm): one equal-size hexagon per district, placed
 * from its centroid. It communicates pattern, never boundary geometry or area.
 */
export function HexMap({
  versions,
  values,
  label,
  onOpenDistrict,
  scaleMax,
  selectedDistrict,
  geometryYear,
  citation,
  title = "Wabenkarte",
}: {
  versions: DistrictVersion[];
  values: Map<number, number | null>;
  label: string;
  onOpenDistrict: (district: number) => void;
  scaleMax?: number;
  selectedDistrict?: number | null;
  geometryYear: number;
  citation?: CitationInput;
  title?: string;
}) {
  const patternId = `hex-unknown-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const bundledYear =
    versions.find((version) => version.bundled_geometry_year)?.bundled_geometry_year ??
    electoralGeometryYear(geometryYear);
  const geometry = useQuery({
    queryKey: ["election-research", "hexmap", bundledYear, ELECTORAL_TOPOLOGY_VERSION],
    enabled: bundledYear != null,
    queryFn: () => loadElectoralTopology(bundledYear!),
    staleTime: Infinity,
    gcTime: 600_000,
    retry: false,
  });
  const layout = useMemo(
    () =>
      hexGridLayout(
        districtCentroids((geometry.data?.features ?? []) as unknown as LooseFeature[]),
      ),
    [geometry.data],
  );
  const maximum =
    scaleMax ??
    Math.max(1, ...[...values.values()].filter((value): value is number => value !== null).map(Math.abs));
  if (geometry.isLoading)
    return <p role="status" className="text-sm">Wabenkarte lädt …</p>;
  if (geometry.error || !layout.cells.length)
    return (
      <p className="rounded-lg border p-3 text-sm text-muted-foreground">
        Für diese Auswahl ist keine Wabenkarte verfügbar. Die Tabelle bleibt nutzbar.
      </p>
    );
  return (
    <ChartExport title={title} filename={`${title}-${geometryYear}`} citation={citation}>
      <div className="space-y-2">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="h-auto w-full rounded-lg border bg-[#f7f8f4]"
          role="img"
          aria-label={`Wabenkarte ${label}: ein gleich großes Sechseck je Wahlkreis, angeordnet nach Lage; genaue Werte in der Tabelle`}
        >
          <defs>
            <pattern
              id={patternId}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="#e5e7eb" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#9ca3af" strokeWidth="2" />
            </pattern>
          </defs>
          {layout.cells.map((cell) => {
            const version = versions.find((entry) => entry.district_number === cell.number);
            const value = values.get(cell.number) ?? null;
            const selected = selectedDistrict === cell.number;
            const name = version?.district_name ?? cell.name;
            const text = `${cell.number}: ${name} · ${value === null ? "unbekannt / nicht vergleichbar" : `${format(value)} ${label}`}`;
            return (
              <g
                key={cell.number}
                role="button"
                tabIndex={0}
                aria-label={text}
                aria-pressed={selected}
                className="cursor-pointer focus-visible:outline-none"
                onClick={() => onOpenDistrict(cell.number)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenDistrict(cell.number);
                  }
                }}
              >
                <title>{text}</title>
                <polygon
                  points={hexPolygon(cell.cx, cell.cy, layout.size - 1.4)}
                  fill={value === null ? `url(#${patternId})` : signedColor(value, maximum)}
                  stroke={selected ? "#111827" : "#ffffff"}
                  strokeWidth={selected ? 3 : 1.2}
                />
                <text
                  x={cell.cx}
                  y={cell.cy + 3}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  fill={value === null ? "#4b5563" : "#111827"}
                  pointerEvents="none"
                >
                  {cell.number}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Schematische Wabenkarte: je Wahlkreis ein gleich großes Sechseck, nach
            Lage angeordnet – keine Flächen- oder Grenzaussage.
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-[linear-gradient(90deg,#c26b28,#f0f1eb,#2563a6)]" aria-hidden="true" />
            −{maximum.toLocaleString("de-DE", { maximumFractionDigits: 2 })} bis +
            {maximum.toLocaleString("de-DE", { maximumFractionDigits: 2 })} {label}
          </span>
        </div>
      </div>
    </ChartExport>
  );
}
