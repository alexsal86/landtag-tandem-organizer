import { useMemo } from 'react';
import { ReleaseCockpit } from '@/features/election-analysis/research/ReleaseCockpit';
import { useQualityData } from '@/features/election-analysis/research/hooks';
import { validateElectionData } from '@/features/election-analysis/research/calculations';
import { DataState, DataTable, StatusNote } from '@/features/election-analysis/shared';
import { number, ballotLabels } from '@/features/election-analysis/model';
export default function QualityPanel({ year }: { year: number }) {
  const query = useQualityData(year);
  const data = query.data;
  const issues = useMemo(
    () =>
      data ? validateElectionData(data.results, data.turnout, data.state) : [],
    [data],
  );
  const unknown = data?.versions.filter((v) => !v.identity_key).length || 0;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Datenprüfung {year}</h2>
      <ReleaseCockpit year={year}/>
      <StatusNote>
        Prüft die ausgewählte Wahl, keine vollständigen Datenbestände anderer
        Jahre. Ein fehlerfreier Zahlenabgleich ersetzt keine Bestätigung von
        Quellen, Grenzen oder Kandidaturvollständigkeit.
      </StatusNote>
      <DataState
        loading={query.isLoading}
        error={query.error}
        empty={!data}
        retry={() => void query.refetch()}
      >
        <p className="text-sm">
          {issues.filter((i) => i.severity === "error").length} Zahlenfehler ·{" "}
          {issues.filter((i) => i.severity === "warning").length} Statushinweise
          · {unknown} nicht verifizierte Zuschnittidentitäten
        </p>

        {issues.length ? (
          <DataTable
            headers={[
              "Typ",
              "Code",
              "Wahlkreis",
              "Partei",
              "Stimmenart",
              "Meldung",
            ]}
            rows={issues.map((i) => [
              i.severity,
              i.code,
              number(i.district),
              i.party || "—",
              i.ballot ? ballotLabels[i.ballot] : "—",
              i.message,
            ])}
          />
        ) : (
          <p className="rounded-lg border p-4 text-sm">
            Keine Unstimmigkeiten in den geprüften Zahlenregeln gefunden.
          </p>
        )}
      </DataState>
    </div>
  );
}
