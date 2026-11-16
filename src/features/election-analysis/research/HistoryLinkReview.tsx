import { useDistrictVersions } from "./hooks";
import type {
  ElectionPeriod,
  HistoricalDistrict,
} from "@/features/election-history/types";

/** Read-only status of automatic links within the SAME election. */
export function HistoryLinkReview({
  period,
  districts,
}: {
  period: ElectionPeriod;
  districts: HistoricalDistrict[];
}) {
  const versions = useDistrictVersions(period.election_year || 0);
  const historical = districts.filter((district) => district.period_id === period.id);
  const linked = historical.filter((district) => versions.data?.some((version) =>
    version.history_link_verified && version.historical_district_id === district.id &&
    version.district_number === district.district_number,
  ));
  const unresolved = historical.filter((district) => !linked.includes(district));
  const conflicts = versions.data?.filter((version) => !historical.some((district) =>
    district.id === version.historical_district_id &&
    district.district_number === version.district_number && version.history_link_verified,
  )) || [];

  return (
    <section className="rounded-lg border p-3 text-sm" aria-label="Automatische Verbindung zur Wahlanalyse">
      <h3 className="font-medium">Automatische Verbindung zur Wahlanalyse</h3>
      <p className="my-2 text-muted-foreground">
        Wahljahr, Legislaturperiode und eindeutige Wahlkreisnummer verbinden die
        Wahlergebnisse automatisch mit den bereits zugeordneten Abgeordneten und
        Mandaten. Du musst die Wahlkreise nicht einzeln bestätigen. Die Verbindung
        gilt für dieselbe Wahl; sie setzt keine Grenzen verschiedener Jahre gleich.
      </p>
      {versions.isLoading && <p role="status">Verbindungen werden geladen …</p>}
      {versions.error && <p role="alert">Der Verbindungsstatus konnte nicht geladen werden.</p>}
      {!versions.isLoading && !versions.error && <>
        <p role="status">{linked.length} von {historical.length} historischen Wahlkreisen mit der Wahlanalyse verbunden.</p>
        {!period.is_published && <p className="mt-2 text-muted-foreground">Die Mandate werden für andere Nutzer sichtbar, sobald diese Legislaturperiode freigegeben ist.</p>}
        {(unresolved.length > 0 || conflicts.length > 0) && <details className="mt-3">
          <summary className="cursor-pointer font-medium">Noch nicht eindeutig verknüpfte Einträge</summary>
          <p className="my-2 text-muted-foreground">
            {period.election_year === 1952
              ? "1952 verwendet regionale Wahlkreisnummern. Diese lassen sich nicht anhand einer landesweiten Nummer automatisch verbinden."
              : "Hier fehlt noch das passende Analysejahr oder die automatische Datenbankzuordnung, eine Wahlkreisnummer ist unklar oder eine bestehende Verknüpfung widerspricht den Daten."}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {unresolved.map((district) => <li key={district.id}>
              Mandatshistorie: {district.number_label || district.district_number || "Nummer fehlt"} · {district.name}
            </li>)}
            {conflicts.map((version) => <li key={version.district_number}>
              Wahlanalyse: {version.district_number} · {version.district_name}
            </li>)}
          </ul>
        </details>}
      </>}
    </section>
  );
}
