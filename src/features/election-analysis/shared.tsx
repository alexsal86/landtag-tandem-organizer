import { analysisError } from "./useElectionAnalysis";
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { compareAnalysisValues } from "./model";
const selectClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm";
export const chartColor = (party: string) =>
  party === "FDP" ? "#a68a00" : getPartyColor(party);
export function Selection({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </div>
  );
}
export function DataState({
  loading,
  error,
  empty,
  retry,
  children,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading)
    return (
      <p role="status" className="py-8 text-sm text-muted-foreground">
        Lade ausgewählte Auswertung …
      </p>
    );
  if (error)
    return (
      <div className="rounded-lg border p-4">
        <p role="alert">{analysisError(error)}</p>
        <Button className="mt-3" variant="outline" onClick={retry}>
          Erneut laden
        </Button>
      </div>
    );
  if (empty)
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        Für diese Auswahl sind keine Daten hinterlegt. Fehlende Angaben sind
        keine Nullwerte.
      </p>
    );
  return <>{children}</>;
}
export function DataTable({
  headers,
  rows,
  sortValues,
  sortableColumns = [],
}: {
  headers: string[];
  rows: ReactNode[][];
  sortValues?: (string | number | null)[][];
  sortableColumns?: number[];
}) {
  const [limit, setLimit] = useState(25);
  const [sort, setSort] = useState<{
    column: number;
    direction: "asc" | "desc";
  } | null>(null);
  const sortedRows = rows.map((row, index) => ({ row, index }));
  if (sort && sortValues)
    sortedRows.sort(
      (a, b) =>
        compareAnalysisValues(
          sortValues[a.index]?.[sort.column] ?? null,
          sortValues[b.index]?.[sort.column] ?? null,
          sort.direction,
        ) || a.index - b.index,
    );
  const changeSort = (column: number) => {
    setSort((previous) => ({
      column,
      direction:
        previous?.column === column && previous.direction === "asc"
          ? "desc"
          : "asc",
    }));
    setLimit(25);
  };
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              {headers.map((header, index) => {
                const sortable =
                  !!sortValues && sortableColumns.includes(index);
                const active = sort?.column === index;
                const Icon = active
                  ? sort.direction === "asc"
                    ? ArrowUp
                    : ArrowDown
                  : ArrowUpDown;
                return (
                  <th
                    key={header}
                    scope="col"
                    aria-sort={
                      sortable
                        ? active
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className="whitespace-nowrap p-3 text-left font-medium"
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => changeSort(index)}
                        aria-label={`${header}: ${active && sort.direction === "asc" ? "absteigend" : "aufsteigend"} sortieren`}
                      >
                        {header}
                        <Icon
                          aria-hidden="true"
                          className={`h-3.5 w-3.5 ${active ? "text-foreground" : "text-muted-foreground"}`}
                        />
                      </button>
                    ) : (
                      header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.slice(0, limit).map(({ row, index }) => (
              <tr key={index} className="border-t">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="p-3 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => setLimit((value) => value + 25)}
        >
          Weitere 25 anzeigen ({limit} von {rows.length})
        </Button>
      )}
    </div>
  );
}
export function StatusNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
export function PartyLabel({ party }: { party: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: chartColor(party) }}
      />
      {party}
    </span>
  );
}
