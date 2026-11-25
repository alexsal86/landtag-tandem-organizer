import { ChartExport, type CitationInput } from "../ChartExport";
import { signedColor } from "./mapModel";

export interface SmallMultipleCell {
  districtNumber: number;
  districtName: string;
  /** Slope start in the same unit as `value`; null when the value is unknown. */
  from: number | null;
  /** Slope end in the same unit as `value`; null when the value is unknown. */
  to: number | null;
  value: number | null;
}

const format = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;

/**
 * One shared-scale slope per district in a single SVG, so the whole panel exports
 * as one figure and districts stay directly comparable. `from`/`to` must describe
 * the same metric as `value` (their difference is the labelled number).
 */
export function SmallMultiples({
  cells,
  selectedDistrict,
  onSelect,
  label,
  citation,
  title = "Kleine Vielfache",
  note,
}: {
  cells: SmallMultipleCell[];
  selectedDistrict?: number | null;
  onSelect: (district: number) => void;
  label: string;
  citation?: CitationInput;
  title?: string;
  note?: string;
}) {
  const measured = cells.flatMap((cell) =>
    [cell.from, cell.to].filter((value): value is number => value !== null && Number.isFinite(value)),
  );
  if (!cells.length || !measured.length)
    return (
      <p className="rounded-lg border p-3 text-sm text-muted-foreground">
        Keine vergleichbaren Wahlkreiswerte für kleine Vielfache.
      </p>
    );
  const min = Math.min(...measured);
  const max = Math.max(...measured);
  const span = max - min || 1;
  const columns = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(cells.length))));
  const rows = Math.ceil(cells.length / columns);
  const cellWidth = 66;
  const cellHeight = 54;
  const gapX = 8;
  const gapY = 10;
  const padding = 6;
  const width = columns * (cellWidth + gapX) + gapX;
  const height = rows * (cellHeight + gapY) + gapY + 18;
  const y = (value: number) =>
    padding + (1 - (value - min) / span) * (cellHeight - padding * 2);
  const maximum = Math.max(1, ...cells.map((cell) => Math.abs(cell.value ?? 0)));
  return (
    <ChartExport title={title} filename={title} citation={citation}>
      <div className="space-y-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full rounded-lg border bg-white"
          role="img"
          aria-label={`${title}: je Wahlkreis eine kleine Steigungslinie von ${format(min)} bis ${format(max)} ${label}; genaue Werte in der Tabelle`}
        >
          <text x={gapX} y={12} fontSize={9} fill="#4b5563">
            {label} · gemeinsame Skala {min.toLocaleString("de-DE", { maximumFractionDigits: 1 })} bis {max.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
          </text>
          {cells.map((cell, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = gapX + column * (cellWidth + gapX);
            const yTop = 18 + gapY + row * (cellHeight + gapY);
            const selected = selectedDistrict === cell.districtNumber;
            const color = signedColor(cell.value, maximum);
            const known = cell.from !== null && cell.to !== null;
            return (
              <g
                key={cell.districtNumber}
                role="button"
                tabIndex={0}
                aria-label={`${cell.districtNumber}: ${cell.districtName} · ${cell.value === null ? "unbekannt" : `${format(cell.value)} ${label}`}`}
                aria-pressed={selected}
                className="cursor-pointer"
                onClick={() => onSelect(cell.districtNumber)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(cell.districtNumber);
                  }
                }}
              >
                <title>
                  {`${cell.districtNumber}: ${cell.districtName} · ${known ? `${cell.from!.toLocaleString("de-DE")} → ${cell.to!.toLocaleString("de-DE")} (${format(cell.value ?? 0)} ${label})` : "unbekannt"}`}
                </title>
                <rect
                  x={x}
                  y={yTop}
                  width={cellWidth}
                  height={cellHeight}
                  rx={4}
                  fill={selected ? "#eef2e6" : "#ffffff"}
                  stroke={selected ? "#111827" : "#e5e7eb"}
                  strokeWidth={selected ? 2 : 1}
                />
                <text x={x + 4} y={yTop + 11} fontSize={9} fontWeight={600} fill="#111827">
                  {cell.districtNumber}
                </text>
                {known ? (
                  <>
                    <line
                      x1={x + 6}
                      y1={yTop + y(cell.from!)}
                      x2={x + cellWidth - 6}
                      y2={yTop + y(cell.to!)}
                      stroke={color}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                    />
                    <circle cx={x + 6} cy={yTop + y(cell.from!)} r={2.2} fill="#ffffff" stroke={color} strokeWidth={1.4} />
                    <circle cx={x + cellWidth - 6} cy={yTop + y(cell.to!)} r={2.2} fill={color} />
                    <text
                      x={x + cellWidth - 4}
                      y={yTop + cellHeight - 4}
                      textAnchor="end"
                      fontSize={9}
                      fontWeight={700}
                      fill="#111827"
                    >
                      {cell.value === null ? "–" : format(cell.value)}
                    </text>
                  </>
                ) : (
                  <text x={x + cellWidth / 2} y={yTop + cellHeight / 2 + 3} textAnchor="middle" fontSize={10} fill="#6b7280">
                    –
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="text-xs text-muted-foreground">
          Alle Kacheln nutzen dieselbe Skala. Linie und Zahl zeigen dieselbe Kennzahl. Fehlende Werte bleiben „–“, nicht null.{note ? ` ${note}` : ""}
        </p>
      </div>
    </ChartExport>
  );
}
